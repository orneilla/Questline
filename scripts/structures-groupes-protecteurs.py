"""
Dessine les structures du catalogue « Groupes protecteurs » et les range dans
`src/lib/cartes/catalogues/groupes-protecteurs-structures.ts`.

    pip install rdkit
    python3 scripts/structures-groupes-protecteurs.py

Le fichier produit est versionné : ce script ne sert qu'à le régénérer quand on
ajoute ou corrige une molécule. RDKit calcule les coordonnées et trace les
molécules ; ce script les oriente (le substrat R–O à gauche, le groupe à
droite), les met toutes à la même échelle, grise la partie qui appartient au
substrat et assemble les schémas réactionnels.

Les dessins sont en noir sur fond transparent, comme un export ChemDraw :
l'extension `.svg` de leur adresse les fait inverser par CSS sur fond sombre.
"""

from __future__ import annotations

import html
import json
import math
import re
from dataclasses import dataclass, field
from pathlib import Path

from rdkit import Chem
from rdkit.Chem import rdDepictor
from rdkit.Chem.Draw import rdMolDraw2D
from rdkit.Geometry import Point3D

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "src/lib/cartes/catalogues/groupes-protecteurs-structures.ts"

LIAISON_PX = 26  # longueur d'une liaison, en pixels
POLICE_PX = 15  # corps des symboles d'atomes
TRAIT_PX = 1.5
GRIS = "#8c8c8c"  # le substrat, en retrait : c'est le groupe qu'on apprend
POLICE_TEXTE = "Helvetica, Arial, sans-serif"

# Étiquettes : (lue vers l'est, lue vers l'ouest). RDKit choisit selon le côté
# d'où part la liaison — « RO– » à gauche d'une molécule, « –OR » à droite.
ETIQUETTES = {
    "RO": ("OR", "RO"),
    "RHN": ("NHR", "RHN"),
    "R": ("R", "R"),
    "R'": ("R'", "R'"),
    "R1": ("R<sub>1</sub>", "R<sub>1</sub>"),
    "R2": ("R<sub>2</sub>", "R<sub>2</sub>"),
    "OAc": ("OAc", "AcO"),
}
SUBSTRAT = {"RO", "RHN", "R", "R'"}


@dataclass
class Molecule:
    smiles: str
    # numéro de carte d'atome → étiquette de ETIQUETTES
    etiquettes: dict[int, str] = field(default_factory=dict)
    # numéro de carte d'atome → petite note (astérisque d'un centre créé)
    notes: dict[int, str] = field(default_factory=dict)
    # orienter la liaison (a → b) vers l'est, par numéros de carte ; b = 0 vise
    # l'atome le plus éloigné de a, pour qu'une chaîne se lise à l'horizontale
    axe: tuple[int, int] | None = None
    # coordonnées imposées, atome par atome dans l'ordre du SMILES
    coords: list[tuple[float, float]] | None = None
    rotation: float = 0.0  # degrés, appliqués après l'axe
    miroir: bool = False
    coordgen: bool = False
    # double liaison C=C dessinée sans géométrie imposée (liaison croisée)
    double_libre: bool = False


def _mol(spec: Molecule):
    m = Chem.MolFromSmiles(spec.smiles)
    if m is None:
        raise ValueError(f"SMILES illisible : {spec.smiles}")
    cartes: dict[int, int] = {}
    gris: set[int] = set()
    for atome in m.GetAtoms():
        # « [O:1] » sans hydrogène passerait pour un radical : un point s'afficherait.
        atome.SetNumRadicalElectrons(0)
        n = atome.GetAtomMapNum()
        if n:
            cartes[n] = atome.GetIdx()
            atome.SetAtomMapNum(0)
    for n, cle in spec.etiquettes.items():
        est, ouest = ETIQUETTES[cle]
        atome = m.GetAtomWithIdx(cartes[n])
        atome.SetProp("_displayLabel", est)
        atome.SetProp("_displayLabelW", ouest)
        if cle in SUBSTRAT:
            gris.add(cartes[n])
    for n, note in spec.notes.items():
        m.GetAtomWithIdx(cartes[n]).SetProp("atomNote", note)

    if spec.double_libre:
        for liaison in m.GetBonds():
            if liaison.GetBondType() == Chem.BondType.DOUBLE:
                liaison.SetStereo(Chem.BondStereo.STEREOANY)
                liaison.SetBondDir(Chem.BondDir.EITHERDOUBLE)

    rdDepictor.SetPreferCoordGen(spec.coordgen)
    rdDepictor.Compute2DCoords(m)
    conf = m.GetConformer()
    if spec.coords:
        for i, (x, y) in enumerate(spec.coords):
            conf.SetAtomPosition(i, Point3D(x, y, 0))

    def transformer(f):
        for i in range(m.GetNumAtoms()):
            p = conf.GetAtomPosition(i)
            x, y = f(p.x, p.y)
            conf.SetAtomPosition(i, Point3D(x, y, 0))

    if spec.axe:
        a = conf.GetAtomPosition(cartes[spec.axe[0]])
        if spec.axe[1]:
            b = conf.GetAtomPosition(cartes[spec.axe[1]])
        else:
            b = max((conf.GetAtomPosition(i) for i in range(m.GetNumAtoms())), key=lambda p: (p - a).Length())
        angle = -math.atan2(b.y - a.y, b.x - a.x)
        c, s = math.cos(angle), math.sin(angle)
        transformer(lambda x, y: (x * c - y * s, x * s + y * c))
    if spec.rotation:
        r = math.radians(spec.rotation)
        c, s = math.cos(r), math.sin(r)
        transformer(lambda x, y: (x * c - y * s, x * s + y * c))
    if spec.miroir:
        transformer(lambda x, y: (x, -y))

    longueurs = [
        (conf.GetAtomPosition(l.GetBeginAtomIdx()) - conf.GetAtomPosition(l.GetEndAtomIdx())).Length()
        for l in m.GetBonds()
    ]
    moyenne = sum(longueurs) / len(longueurs) if longueurs else 1.5
    return m, gris, moyenne


def _nettoyer(svg: str, gris: set[int]) -> tuple[str, float, float]:
    """Retire l'en-tête RDKit, grise le substrat, factorise les styles."""
    largeur = float(re.search(r"width='([\d.]+)px'", svg).group(1))
    hauteur = float(re.search(r"height='([\d.]+)px'", svg).group(1))
    corps = svg[svg.index("<!-- END OF HEADER -->") + len("<!-- END OF HEADER -->") :]
    corps = corps.replace("</svg>", "").strip()

    def recolorer(m: re.Match) -> str:
        balise = m.group(0)
        classes = re.search(r"class='([^']*)'", balise)
        noms = classes.group(1).split() if classes else []
        # Une étiquette d'atome porte la seule classe « atom-N ».
        if len(noms) == 1 and noms[0].startswith("atom-"):
            # Les glyphes sont pleins : sans cela ils hériteraient du trait des liaisons.
            balise = balise.replace("/>", " stroke='none'/>")
            if int(noms[0][5:]) in gris:
                balise = balise.replace("#000000", GRIS)
        return balise

    corps = re.sub(r"<path[^>]*/>", recolorer, corps)
    corps = re.sub(r"\s*class='[^']*'", "", corps)
    # Les traits : un seul style pour tous, porté par le groupe.
    corps = corps.replace(
        f"style='fill:none;fill-rule:evenodd;stroke:#000000;stroke-width:{TRAIT_PX:.1f}px;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1'",
        "",
    )
    corps = re.sub(r"<rect[^>]*/>", "", corps)
    corps = re.sub(r"\n+", "", corps)
    corps = re.sub(r"\s+/>", "/>", corps)
    corps = corps.replace("fill-rule:evenodd;", "").replace(";stroke-opacity:1", "")
    return corps, largeur, hauteur


def dessiner(spec: Molecule) -> tuple[str, float, float]:
    m, gris, moyenne = _mol(spec)
    d = rdMolDraw2D.MolDraw2DSVG(-1, -1)
    o = d.drawOptions()
    o.scalingFactor = LIAISON_PX / moyenne
    o.bondLineWidth = TRAIT_PX
    o.scaleBondWidth = False
    o.fixedFontSize = POLICE_PX
    o.annotationFontScale = 0.9
    o.padding = 0.05
    o.clearBackground = False
    o.multipleBondOffset = 0.17
    o.useBWAtomPalette()
    d.DrawMolecule(m)
    d.FinishDrawing()
    return _nettoyer(d.GetDrawingText(), gris)


# ───────────────────────────── Composition ─────────────────────────────


@dataclass
class Bloc:
    corps: str
    largeur: float
    hauteur: float


def _texte(x: float, y: float, contenu: str, taille=12.5, couleur="#000000", ancre="middle", italique=False) -> str:
    style = " font-style='italic'" if italique else ""
    return (
        f"<text x='{x:.1f}' y='{y:.1f}' font-size='{taille}' fill='{couleur}' stroke='none' "
        f"text-anchor='{ancre}'{style}>{html.escape(contenu)}</text>"
    )


def _largeur_texte(contenu: str, taille=12.5) -> float:
    return len(contenu) * taille * 0.56


def molecule(spec: Molecule, legende: str | None = None, legende_couleur=GRIS) -> Bloc:
    corps, l, h = dessiner(spec)
    if not legende:
        return Bloc(corps, l, h)
    lt = _largeur_texte(legende, 13)
    L = max(l, lt)
    dx = (L - l) / 2
    contenu = f"<g transform='translate({dx:.1f},0)'>{corps}</g>" + _texte(L / 2, h + 14, legende, 13, legende_couleur)
    return Bloc(contenu, L, h + 20)


def texte_seul(lignes: list[str], taille=14) -> Bloc:
    L = max(_largeur_texte(t, taille) for t in lignes) + 4
    H = len(lignes) * (taille + 4)
    contenu = "".join(_texte(L / 2, (i + 1) * (taille + 4) - 4, t, taille) for i, t in enumerate(lignes))
    return Bloc(contenu, L, H)


def fleche(dessus: list[str] = (), dessous: list[str] = (), minimum=56) -> Bloc:
    largeur = max([minimum] + [_largeur_texte(t, 12) + 12 for t in [*dessus, *dessous]])
    ligne = 15
    haut = len(dessus) * ligne + 4
    bas = len(dessous) * ligne + 4
    y = haut + 2
    corps = (
        f"<path d='M 4,{y:.1f} L {largeur - 6:.1f},{y:.1f}' style='fill:none;stroke:#000000;stroke-width:1.3px'/>"
        f"<path d='M {largeur - 4:.1f},{y:.1f} L {largeur - 12:.1f},{y - 4:.1f} L {largeur - 12:.1f},{y + 4:.1f} Z' style='fill:#000000;stroke:none'/>"
    )
    for i, t in enumerate(dessus):
        corps += _texte(largeur / 2, (i + 1) * ligne - 3, t, 12)
    for i, t in enumerate(dessous):
        corps += _texte(largeur / 2, y + 4 + (i + 1) * ligne - 3, t, 12)
    return Bloc(corps, largeur, y + bas + 2)


def fleche_bas(textes: list[str] = (), hauteur=40) -> Bloc:
    """Flèche verticale, conditions à droite : un schéma qui tient sur un téléphone."""
    largeur_texte = max([0] + [_largeur_texte(t, 12) for t in textes])
    x = 8
    corps = (
        f"<path d='M {x},2 L {x},{hauteur - 8}' style='fill:none;stroke:#000000;stroke-width:1.3px'/>"
        f"<path d='M {x},{hauteur - 2} L {x - 4},{hauteur - 10} L {x + 4},{hauteur - 10} Z' style='fill:#000000;stroke:none'/>"
    )
    debut = hauteur / 2 - (len(textes) * 15) / 2 + 11
    for i, t in enumerate(textes):
        corps += _texte(x + 10, debut + i * 15, t, 12, ancre="start")
    return Bloc(corps, x + 10 + largeur_texte, hauteur)


def cascade(*etapes: Bloc | list[str]) -> Bloc:
    """Molécules les unes sous les autres, reliées par des flèches verticales."""
    blocs = [fleche_bas(e) if isinstance(e, list) else e for e in etapes]
    L = max(b.largeur for b in blocs)
    y = 0.0
    corps = ""
    for b in blocs:
        # Les flèches s'alignent sur l'axe des molécules, leur texte déborde à droite.
        dx = (L - b.largeur) / 2 if b.largeur > 60 or not corps else L / 2 - 8
        corps += f"<g transform='translate({dx:.1f},{y:.1f})'>{b.corps}</g>"
        y += b.hauteur + 6
    return Bloc(corps, L, y - 6)


def ligne(*blocs: Bloc, espace=10.0) -> Bloc:
    """Aligne des blocs horizontalement, centrés sur la verticale."""
    H = max(b.hauteur for b in blocs)
    x = 0.0
    corps = ""
    for b in blocs:
        corps += f"<g transform='translate({x:.1f},{(H - b.hauteur) / 2:.1f})'>{b.corps}</g>"
        x += b.largeur + espace
    return Bloc(corps, x - espace, H)


def colonne(*blocs: Bloc, espace=14.0) -> Bloc:
    L = max(b.largeur for b in blocs)
    y = 0.0
    corps = ""
    for b in blocs:
        corps += f"<g transform='translate({(L - b.largeur) / 2:.1f},{y:.1f})'>{b.corps}</g>"
        y += b.hauteur + espace
    return Bloc(corps, L, y - espace)


def svg(bloc: Bloc) -> str:
    L, H = math.ceil(bloc.largeur + 4), math.ceil(bloc.hauteur + 4)
    return (
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{L}' height='{H}' viewBox='0 0 {L} {H}' "
        f"font-family='{POLICE_TEXTE}'>"
        f"<g transform='translate(2,2)' style='fill:none;stroke:#000000;stroke-width:{TRAIT_PX}px;stroke-linecap:round;stroke-linejoin:round'>"
        f"{bloc.corps}</g></svg>"
    )


# ────────────────────────────── Molécules ──────────────────────────────

RO = {1: "RO"}
RHN = {1: "RHN"}
AXE = (1, 0)  # de l'atome attaché au substrat vers le bout du groupe
VOISIN = (1, 2)  # de l'atome attaché au substrat vers son voisin


def ether(smiles: str, **options) -> Molecule:
    """Un groupe sur R–O : l'oxygène porte la carte 1, son voisin la carte 2."""
    return Molecule(smiles, etiquettes=RO, **{"axe": AXE, **options})


def amine(smiles: str, **options) -> Molecule:
    return Molecule(smiles, etiquettes=RHN, **{"axe": AXE, **options})


# Sommets d'un cyclopentène dessiné comme dans le fascicule (liaison de 1,5).
_P = {
    "haut": (0.394, 1.214),
    "g-haut": (-1.032, 0.75),
    "g-bas": (-1.032, -0.75),
    "bas": (0.394, -1.214),
    "droite": (1.276, 0.0),
    "haut+": (0.394, 2.714),
    "bas-": (0.394, -2.714),
}

M = {
    # 1a — éthers alkyles
    "tbu": ether("[O:1][C:2](C)(C)C", axe=VOISIN),
    "allyl": ether("[O:1][CH2:2]C=C"),
    # Géométrie non précisée par les sources : la double liaison est dessinée croisée.
    "enol-propenyl": ether("[O:1][CH:2]=CC", double_libre=True),
    "bn": ether("[O:1][CH2:2]c1ccccc1"),
    "pmb": ether("[O:1][CH2:2]c1ccc(OC)cc1"),
    "tr": ether("[O:1][C:2](c1ccccc1)(c1ccccc1)c1ccccc1", axe=VOISIN),
    # 1b — acétals
    "mom": ether("[O:1][CH2:2]OC"),
    "bom": ether("[O:1][CH2:2]OCc1ccccc1"),
    "sem": ether("[O:1][CH2:2]OCC[Si](C)(C)C"),
    "thp": Molecule("[O:1][CH:2]1CCCCO1", etiquettes=RO, notes={2: "*"}, axe=AXE),
    "dhp": Molecule("C1CC=COC1", rotation=90),
    # 1c — éthers silylés
    "tms": ether("[O:1][Si:2](C)(C)C", axe=VOISIN),
    "tes": ether("[O:1][Si:2](CC)(CC)CC", axe=VOISIN),
    "tbs": ether("[O:1][Si:2](C)(C)C(C)(C)C", axe=VOISIN),
    "tips": ether("[O:1][Si:2](C(C)C)(C(C)C)C(C)C", axe=VOISIN),
    "tbdps": ether("[O:1][Si:2](c1ccccc1)(c1ccccc1)C(C)(C)C", axe=VOISIN),
    # 1d — esters
    "formate": ether("[O:1][CH:2]=O"),
    "ac": ether("[O:1][C:2](C)=O"),
    "piv": ether("[O:1][C:2](=O)C(C)(C)C"),
    "bz": ether("[O:1][C:2](=O)c1ccccc1"),
    "pnbz": ether("[O:1][C:2](=O)c1ccc(cc1)[N+](=O)[O-]"),
    # Rem 1 du fascicule : esters méthyliques, du plus lent au plus rapide à hydrolyser
    "me-pivalate": Molecule("COC(=O)C(C)(C)C", rotation=180),
    "me-pmeobenzoate": Molecule("COC(=O)c1ccc(OC)cc1", rotation=180),
    "me-benzoate": Molecule("COC(=O)c1ccccc1", rotation=180),
    "me-acetate": Molecule("COC(C)=O", rotation=180),
    "me-chloroacetate": Molecule("COC(=O)CCl", rotation=180),
    "me-trichloroacetate": Molecule("COC(=O)C(Cl)(Cl)Cl", rotation=180),
    "me-trifluoroacetate": Molecule("COC(=O)C(F)(F)F", rotation=180),
    # Rem 2 : acétal stannylène d'un 1,2-diol
    "diol-bn-glycerol": Molecule("OCC(O)COCc1ccccc1"),
    "stannylene": Molecule("CCCC[Sn]1(CCCC)OCC(COCc2ccccc2)O1"),
    "monoacetate-primaire": Molecule("CC(=O)OCC(O)COCc1ccccc1"),
    # Rem 3 : désymétrisation enzymatique (configurations vérifiées : (1R,4S)-monoacétate).
    # Disposées comme dans le fascicule : C=C à gauche, substituants en haut et en bas.
    "diacetate-meso": Molecule(
        "[O:5][C@@H]1C=C[C@H]([O:6])C1",
        etiquettes={5: "OAc", 6: "OAc"},
        coords=[_P["haut+"], _P["haut"], _P["g-haut"], _P["g-bas"], _P["bas"], _P["bas-"], _P["droite"]],
    ),
    "monoacetate-chiral": Molecule(
        "[O:5][C@H]1C=C[C@@H](O)C1",
        etiquettes={5: "OAc"},
        coords=[_P["bas-"], _P["bas"], _P["g-bas"], _P["g-haut"], _P["haut"], _P["haut+"], _P["droite"]],
    ),
    "acetoxy-cyclopentenone": Molecule(
        "[O:5][C@H]1C=CC(=O)C1",
        etiquettes={5: "OAc"},
        coords=[_P["bas-"], _P["bas"], _P["g-bas"], _P["g-haut"], _P["haut"], _P["haut+"], _P["droite"]],
    ),
    # 2 — diols (R et R' : le squelette qui porte les deux OH)
    "diol-12": Molecule(
        "[*:3]C(O)C(O)[*:4]",
        etiquettes={3: "R", 4: "R'"},
        coords=[(-1.3, -0.75), (0, 0), (-0.45, 1.43), (1.5, 0), (1.95, 1.43), (2.8, -0.75)],
    ),
    "diol-13": Molecule("[*:3]C(O)CC(O)[*:4]", etiquettes={3: "R", 4: "R'"}),
    "dioxolane-generique": Molecule(
        "[*:3]C1O[C:5]([*:6])([*:7])OC1[*:4]", etiquettes={3: "R", 4: "R'", 6: "R1", 7: "R2"}
    ),
    "dioxane-generique": Molecule(
        "[*:3]C1C[C:9]([*:4])O[C:5]([*:6])([*:7])O1", etiquettes={3: "R", 4: "R'", 6: "R1", 7: "R2"}
    ),
    "methylene": Molecule("[*:3]C1OCOC1[*:4]", etiquettes={3: "R", 4: "R'"}),
    "ethylidene": Molecule("[*:3]C1OC(C)OC1[*:4]", etiquettes={3: "R", 4: "R'"}),
    "acetonide": Molecule("[*:3]C1OC(C)(C)OC1[*:4]", etiquettes={3: "R", 4: "R'"}),
    "benzylidene": Molecule("[*:3]C1CC([*:4])OC(c2ccccc2)O1", etiquettes={3: "R", 4: "R'"}),
    "acetone": Molecule("CC(C)=O"),
    "dmp": Molecule("COC(C)(C)OC"),
    "methoxypropene": Molecule("COC(C)=C"),
    "triol-williams": Molecule("OCC(O)C(C)CO"),
    "acetonide-12-williams": Molecule("CC1(C)OCC(O1)C(C)CO"),
    "acetonide-13-williams": Molecule("CC1(C)OCC(C)C(CO)O1"),
    "benzylidene-13": Molecule("[*:3]C1CCOC(c2ccccc2)O1", etiquettes={3: "R"}),
    "reduction-a": Molecule("[*:3]C(O)CCOCc1ccccc1", etiquettes={3: "R"}),
    "reduction-b": Molecule("[*:3]C(OCc1ccccc1)CCO", etiquettes={3: "R"}),
    "carbonate": Molecule("[*:3]C1OC(=O)OC1[*:4]", etiquettes={3: "R", 4: "R'"}),
    "orthoester": Molecule("[*:3]C1OC(C)(OC)OC1[*:4]", etiquettes={3: "R", 4: "R'"}),
    # 3 — cétones (R et R' : les deux chaînes de la cétone)
    "cetone": Molecule("[*:3]C(=O)[*:4]", etiquettes={3: "R", 4: "R'"}),
    "dimethylacetal": Molecule("[*:3]C([*:4])(OC)OC", etiquettes={3: "R", 4: "R'"}),
    "dioxane": Molecule("[*:3]C1([*:4])OCCCO1", etiquettes={3: "R", 4: "R'"}),
    "dioxolane": Molecule("[*:3]C1([*:4])OCCO1", etiquettes={3: "R", 4: "R'"}),
    "dimethylthioacetal": Molecule("[*:3]C([*:4])(SC)SC", etiquettes={3: "R", 4: "R'"}),
    "dithiane": Molecule("[*:3]C1([*:4])SCCCS1", etiquettes={3: "R", 4: "R'"}),
    "dithiolane": Molecule("[*:3]C1([*:4])SCCS1", etiquettes={3: "R", 4: "R'"}),
    "oxathiolane": Molecule("[*:3]C1([*:4])OCCS1", etiquettes={3: "R", 4: "R'"}),
    "hydrolyse-diethylacetal": Molecule("CCOC(OCC)c1ccccc1"),
    "hydrolyse-dioxolane": Molecule("C1COC(O1)c1ccccc1"),
    "hydrolyse-dithioacetal": Molecule("CCSC(SCC)c1ccccc1"),
    # 4 — amines
    "nbn": amine("[N:1][CH2:2]c1ccccc1"),
    "formamide": amine("[N:1][CH:2]=O"),
    "acetamide": amine("[N:1][C:2](C)=O"),
    "tfa": amine("[N:1][C:2](=O)C(F)(F)F"),
    "boc": amine("[N:1][C:2](=O)OC(C)(C)C"),
    "alloc": amine("[N:1][C:2](=O)OCC=C"),
    "cbz": amine("[N:1][C:2](=O)OCc1ccccc1"),
    "troc": amine("[N:1][C:2](=O)OCC(Cl)(Cl)Cl"),
    "ts": amine("[N:1][S:2](=O)(=O)c1ccc(C)cc1"),
}


def seule(cle: str) -> str:
    return svg(molecule(M[cle]))


def schemas() -> dict[str, str]:
    mol = lambda cle, legende=None: molecule(M[cle], legende)  # noqa: E731
    return {
        "thp-schema": svg(
            ligne(mol("dhp", "DHP"), fleche(["ROH"], ["H⁺ cat. (APTS, PPTS)"]), mol("thp"))
        ),
        "allyl-deux-etapes": svg(
            colonne(
                ligne(mol("allyl"), fleche(["1) t-BuOK, DMSO"], ["ou Rh(PPh₃)₃Cl"]), mol("enol-propenyl")),
                ligne(mol("enol-propenyl"), fleche(["2) H₃O⁺, O₃"], ["ou KMnO₄"]), texte_seul(["ROH"], 15)),
            )
        ),
        "diol-12-dioxolane": svg(ligne(mol("diol-12", "1,2-diol"), fleche(), mol("dioxolane-generique", "1,3-dioxolane (5)"))),
        "diol-13-dioxane": svg(ligne(mol("diol-13", "1,3-diol"), fleche(), mol("dioxane-generique", "1,3-dioxane (6)"))),
        "acetonide-reactifs": svg(
            colonne(
                ligne(mol("acetone", "acétone"), mol("methoxypropene", "2-méthoxypropène"), espace=34),
                mol("dmp", "2,2-diméthoxypropane"),
            )
        ),
        "acetonide-selectivite": svg(
            ligne(
                mol("triol-williams"),
                fleche(["acétone"], ["TsOH"]),
                colonne(
                    mol("acetonide-12-williams", "5 · dioxolane"),
                    mol("acetonide-13-williams", "1 · dioxane"),
                ),
            )
        ),
        "benzylidene-reduction": svg(
            colonne(
                mol("reduction-a", "A · Bn primaire, OH secondaire libre"),
                mol("reduction-b", "B · Bn secondaire, OH primaire libre"),
            )
        ),
        "silyles-rangee": svg(
            colonne(
                ligne(mol("tms", "TMS"), mol("tes", "TES"), mol("tbs", "TBS"), espace=18),
                ligne(mol("tips", "TIPS"), mol("tbdps", "TBDPS"), espace=26),
            )
        ),
        "hydrolyse-acetals": svg(
            colonne(
                ligne(
                    mol("hydrolyse-diethylacetal", "acétal ouvert"),
                    mol("hydrolyse-dioxolane", "1,3-dioxolane"),
                    espace=20,
                ),
                mol("hydrolyse-dithioacetal", "dithioacétal"),
            )
        ),
        "hydrolyse-acetals-vitesses": svg(
            colonne(
                ligne(
                    mol("hydrolyse-diethylacetal", "160"),
                    mol("hydrolyse-dioxolane", "5"),
                    espace=20,
                ),
                mol("hydrolyse-dithioacetal", "3,5 × 10⁻⁴"),
            )
        ),
        "hydrolyse-esters": svg(
            colonne(
                ligne(mol("me-pivalate"), texte_seul(["<"], 16), mol("me-pmeobenzoate")),
                ligne(
                    texte_seul(["<"], 16), mol("me-benzoate"), texte_seul(["<"], 16),
                    mol("me-acetate"), texte_seul(["<"], 16), mol("me-chloroacetate"),
                ),
                ligne(
                    texte_seul(["<"], 16), mol("me-trichloroacetate"),
                    texte_seul(["<"], 16), mol("me-trifluoroacetate"),
                ),
            )
        ),
        "stannylene-schema": svg(
            cascade(
                mol("diol-bn-glycerol"),
                ["Bu₂SnO", "toluène, 100 °C"],
                mol("stannylene"),
                ["AcCl", "CH₂Cl₂, 0 °C"],
                mol("monoacetate-primaire"),
            )
        ),
        "lipase-schema": svg(
            cascade(
                mol("diacetate-meso", "méso"),
                ["acétylcholinestérase", "94 %, 99 % ee"],
                mol("monoacetate-chiral"),
                ["PCC"],
                mol("acetoxy-cyclopentenone"),
            )
        ),
        "paire-pmb-bn": svg(ligne(mol("pmb", "PMB"), mol("bn", "Bn"), espace=24)),
        "paire-boc-cbz": svg(ligne(mol("boc", "Boc"), mol("cbz", "Cbz"), espace=24)),
        "paire-boc-tbs": svg(ligne(mol("boc", "Boc"), mol("tbs", "TBS"), espace=24)),
        "paire-tbs-tbdps": svg(ligne(mol("tbs", "TBS"), mol("tbdps", "TBDPS"), espace=24)),
        "paire-dithiane-acetonide": svg(ligne(mol("dithiane", "dithiocétal"), mol("acetonide", "acétonide"), espace=24)),
        "paire-formate-ac": svg(ligne(mol("formate", "formate"), mol("ac", "Ac"), mol("bz", "Bz"), espace=20)),
        "cetone-dioxolane": svg(ligne(mol("cetone"), fleche(["HO(CH₂)₂OH"], ["APTS, PhMe, reflux"]), mol("dioxolane"))),
        "cetone-dithiane": svg(ligne(mol("cetone"), fleche(["HS(CH₂)₃SH"], ["BF₃·OEt₂"]), mol("dithiane"))),
        "carbonate-schema": svg(ligne(mol("diol-12"), fleche(["triphosgène"], ["pyridine"]), mol("carbonate"))),
        "orthoester-schema": svg(ligne(mol("diol-12"), fleche(["MeC(OMe)₃"], ["H⁺ anhydre"]), mol("orthoester"))),
    }


def main() -> None:
    structures = {cle: seule(cle) for cle in M}
    structures.update(schemas())

    lignes = [
        "/**",
        " * Structures du catalogue « Groupes protecteurs », en SVG.",
        " *",
        " * FICHIER ENGENDRÉ — ne pas modifier à la main. Pour corriger ou ajouter",
        " * une molécule : `python3 scripts/structures-groupes-protecteurs.py`.",
        " *",
        " * Noir sur fond transparent, comme un schéma au trait : l'extension `.svg`",
        " * de l'adresse d'une image fait inverser le dessin par CSS sur fond sombre.",
        " */",
        "",
        "export const STRUCTURES_GROUPES_PROTECTEURS: Record<string, string> = {",
    ]
    for cle, contenu in structures.items():
        lignes.append(f"  {json.dumps(cle)}:")
        lignes.append(f"    {json.dumps(contenu, ensure_ascii=False)},")
    lignes.append("};")
    lignes.append("")
    SORTIE.write_text("\n".join(lignes), encoding="utf-8")

    poids = sum(len(s.encode()) for s in structures.values())
    print(f"{len(structures)} structures, {poids / 1024:.0f} Ko → {SORTIE.relative_to(RACINE)}")


if __name__ == "__main__":
    main()
