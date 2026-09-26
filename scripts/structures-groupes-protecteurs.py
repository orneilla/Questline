"""
Dessine les structures du catalogue « Groupes protecteurs » et les range dans
`src/lib/cartes/catalogues/groupes-protecteurs-structures.ts`.

    pip install rdkit
    python3 scripts/structures-groupes-protecteurs.py

Le fichier produit est versionné : ce script ne sert qu'à le régénérer quand on
ajoute ou corrige une molécule. RDKit calcule les coordonnées et trace les
molécules ; ce script les oriente (le substrat R–O à gauche, le groupe à
droite), les met toutes à la même échelle, grise la partie qui appartient au
substrat et assemble les schémas réactionnels. Il redessine aussi, flèches
comprises, les mécanismes de P. J. Kocienski, *Protecting Groups* (Thieme,
1994) : voir la section « Mécanismes ».

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


def equilibre_bas(textes: list[str] = (), hauteur=40) -> Bloc:
    """Double demi-flèche verticale d'un équilibre, conditions à droite."""
    largeur_texte = max([0] + [_largeur_texte(t, 12) for t in textes])
    x = 10
    trait = "style='fill:none;stroke:#000000;stroke-width:1.3px'"
    corps = (
        f"<path d='M {x - 3},2 L {x - 3},{hauteur - 3} L {x - 8},{hauteur - 10}' {trait}/>"
        f"<path d='M {x + 3},{hauteur - 3} L {x + 3},2 L {x + 8},9' {trait}/>"
    )
    debut = hauteur / 2 - (len(textes) * 15) / 2 + 11
    for i, t in enumerate(textes):
        corps += _texte(x + 14, debut + i * 15, t, 12, ancre="start")
    return Bloc(corps, x + 14 + largeur_texte, hauteur)


class Eq(list):
    """Dans une cascade, une étape d'équilibre plutôt qu'une flèche simple."""


def cascade(*etapes: Bloc | list[str]) -> Bloc:
    """Molécules les unes sous les autres, reliées par des flèches verticales."""
    blocs = [
        equilibre_bas(e) if isinstance(e, Eq) else fleche_bas(e) if isinstance(e, list) else e
        for e in etapes
    ]
    fleches = {id(b) for b, e in zip(blocs, etapes) if isinstance(e, list)}
    L = max([b.largeur for b in blocs if id(b) not in fleches] or [0])
    # Une flèche part de l'axe ; son texte, à droite, peut dépasser la molécule.
    total = max([L] + [L / 2 - 10 + b.largeur for b in blocs if id(b) in fleches])
    y = 0.0
    corps = ""
    for b in blocs:
        # Les flèches s'alignent sur l'axe des molécules, leur texte déborde à droite.
        dx = L / 2 - 10 if id(b) in fleches else (L - b.largeur) / 2
        corps += f"<g transform='translate({dx:.1f},{y:.1f})'>{b.corps}</g>"
        y += b.hauteur + 6
    return Bloc(corps, total, y - 6)


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




# ───────────────────────────── Mécanismes ─────────────────────────────
#
# Chaque mécanisme redessine un schéma de P. J. Kocienski, *Protecting
# Groups*, Thieme, 1994, avec ses flèches : ni flèche ajoutée, ni étape
# inventée. Les atomes que visent les flèches portent un numéro de carte dans
# le SMILES ; une flèche part d'un atome (doublet) ou d'une liaison (couple de
# numéros) et arrive sur un atome ou une liaison.

Ref = int | tuple[int, int]
LIAISON_MECA_PX = 32  # un peu plus grand : les flèches doivent se lire


@dataclass
class Meca:
    smiles: str
    # numéro → texte affiché à la place de l'atome (un « * » du SMILES, souvent)
    etiquettes: dict[int, str] = field(default_factory=dict)
    # numéro → position imposée (en longueurs de liaison), le reste suit
    places: dict[int, tuple[float, float]] = field(default_factory=dict)
    rotation: float = 0.0
    miroir: bool = False  # symétrie haut-bas
    miroir_h: bool = False  # symétrie gauche-droite
    # (départ, arrivée, courbure) ; courbure > 0 : bombée à gauche du trajet
    fleches: list[tuple[Ref, Ref, float]] = field(default_factory=list)
    # (atome ou None, dx, dy, texte) : un contre-ion, une charge délocalisée…
    textes: list[tuple[int | None, float, float, str]] = field(default_factory=list)
    # (atome ou liaison, dx, dy, texte) : trait vers un métal coordiné
    liens: list[tuple[Ref, float, float, str]] = field(default_factory=list)
    # atomes par où passe un arc de délocalisation (π-allyle), côté +1 ou −1
    arcs: list[tuple[list[int], float]] = field(default_factory=list)
    # atomes d'un cycle, dans l'ordre : cercle intérieur, entier ou partiel
    cercles: list[tuple[list[int], bool]] = field(default_factory=list)
    # (atome, dx1, dy1, dx2, dy2) : petit trait libre, en pixels
    traits: list[tuple[int, float, float, float, float]] = field(default_factory=list)
    # fragment n° → position de son centre (en longueurs de liaison)
    fragments: dict[int, tuple[float, float]] = field(default_factory=dict)
    # électrons célibataires : (atome, dx, dy) en pixels — dessinés à la main,
    # ceux de RDKit sont trop petits pour se voir
    radicaux: list[tuple[int, float, float]] = field(default_factory=list)


def _etiquette(texte: str) -> tuple[str, str]:
    return (texte, texte)


def dessiner_meca(spec: Meca) -> Bloc:
    m = Chem.MolFromSmiles(spec.smiles)
    if m is None:
        raise ValueError(f"SMILES illisible : {spec.smiles}")
    cartes: dict[int, int] = {}
    for atome in m.GetAtoms():
        atome.SetNumRadicalElectrons(0)
        n = atome.GetAtomMapNum()
        if n:
            cartes[n] = atome.GetIdx()
            atome.SetAtomMapNum(0)
    etiquetes = set()
    for n, texte in spec.etiquettes.items():
        est, ouest = texte if isinstance(texte, tuple) else _etiquette(texte)
        a = m.GetAtomWithIdx(cartes[n])
        a.SetProp("_displayLabel", est)
        a.SetProp("_displayLabelW", ouest)
        etiquetes.add(cartes[n])

    from rdkit.Geometry import Point2D

    rdDepictor.SetPreferCoordGen(False)
    # Une place prévue pour un atome absent de cette étape est simplement ignorée.
    carte_coords = {cartes[n]: Point2D(x * 1.5, y * 1.5) for n, (x, y) in spec.places.items() if n in cartes}
    rdDepictor.Compute2DCoords(m, coordMap=carte_coords) if carte_coords else rdDepictor.Compute2DCoords(m)
    conf = m.GetConformer()

    def transformer(f):
        for i in range(m.GetNumAtoms()):
            q = conf.GetAtomPosition(i)
            x, y = f(q.x, q.y)
            conf.SetAtomPosition(i, Point3D(x, y, 0))

    if spec.rotation:
        r = math.radians(spec.rotation)
        c, s_ = math.cos(r), math.sin(r)
        transformer(lambda x, y: (x * c - y * s_, x * s_ + y * c))
    if spec.miroir:
        transformer(lambda x, y: (x, -y))
    if spec.miroir_h:
        transformer(lambda x, y: (-x, y))
    for k, groupe in enumerate(Chem.GetMolFrags(m)):
        if k not in spec.fragments:
            continue
        gx = sum(conf.GetAtomPosition(i).x for i in groupe) / len(groupe)
        gy = sum(conf.GetAtomPosition(i).y for i in groupe) / len(groupe)
        tx, ty = spec.fragments[k]
        for i in groupe:
            q = conf.GetAtomPosition(i)
            conf.SetAtomPosition(i, Point3D(q.x - gx + tx * 1.5, q.y - gy + ty * 1.5, 0))

    d = rdMolDraw2D.MolDraw2DSVG(-1, -1)
    o = d.drawOptions()
    o.scalingFactor = LIAISON_MECA_PX / 1.5
    o.bondLineWidth = TRAIT_PX
    o.scaleBondWidth = False
    o.fixedFontSize = POLICE_PX
    o.padding = 0.05
    o.clearBackground = False
    o.multipleBondOffset = 0.17
    o.useBWAtomPalette()
    d.DrawMolecule(m)
    pos = {i: d.GetDrawCoords(i) for i in range(m.GetNumAtoms())}
    d.FinishDrawing()
    corps, L, H = _nettoyer(d.GetDrawingText(), set())

    def visible(i: int) -> bool:
        a = m.GetAtomWithIdx(i)
        return i in etiquetes or a.GetSymbol() != "C" or a.GetFormalCharge() != 0

    def point(ref: Ref) -> tuple[float, float, str, int | None]:
        if isinstance(ref, tuple):
            p, q = pos[cartes[ref[0]]], pos[cartes[ref[1]]]
            return (p.x + q.x) / 2, (p.y + q.y) / 2, "liaison", None
        i = cartes[ref]
        return pos[i].x, pos[i].y, "atome", i

    extras: list[str] = []
    points: list[tuple[float, float]] = []
    trait = f"style='fill:none;stroke:#000000;stroke-width:1.2px'"

    for depart, arrivee, courbure in spec.fleches:
        x0, y0, k0, i0 = point(depart)
        x1, y1, k1, i1 = point(arrivee)
        dx, dy = x1 - x0, y1 - y0
        long = math.hypot(dx, dy) or 1
        nx, ny = -dy / long, dx / long
        cx = (x0 + x1) / 2 + nx * courbure * max(long, 30)
        cy = (y0 + y1) / 2 + ny * courbure * max(long, 30)

        def recule(x, y, k, i, vers_x, vers_y):
            ux, uy = vers_x - x, vers_y - y
            n_ = math.hypot(ux, uy) or 1
            r = 3 if k == "liaison" else (9 if i is not None and visible(i) else 4)
            return x + ux / n_ * r, y + uy / n_ * r

        x0, y0 = recule(x0, y0, k0, i0, cx, cy)
        x1, y1 = recule(x1, y1, k1, i1, cx, cy)
        ux, uy = x1 - cx, y1 - cy
        n_ = math.hypot(ux, uy) or 1
        ux, uy = ux / n_, uy / n_
        fx, fy = x1 - ux * 5, y1 - uy * 5
        extras.append(f"<path d='M {x0:.1f},{y0:.1f} Q {cx:.1f},{cy:.1f} {fx:.1f},{fy:.1f}' {trait}/>")
        bx, by = x1 - ux * 8, y1 - uy * 8
        extras.append(
            f"<path d='M {x1:.1f},{y1:.1f} L {bx - uy * 3.6:.1f},{by + ux * 3.6:.1f} "
            f"L {bx + uy * 3.6:.1f},{by - ux * 3.6:.1f} Z' style='fill:#000000;stroke:none'/>"
        )
        points += [(x0, y0), (cx, cy), (x1, y1)]

    for ancre, dx, dy, texte in spec.textes:
        x, y = (pos[cartes[ancre]].x, pos[cartes[ancre]].y) if ancre is not None else (0, 0)
        extras.append(_texte(x + dx, y + dy + 4.5, texte, 13))
        w = _largeur_texte(texte, 13)
        points += [(x + dx - w / 2, y + dy - 8), (x + dx + w / 2, y + dy + 8)]

    for ref, dx, dy, texte in spec.liens:
        x, y, _, _ = point(ref)
        n_ = math.hypot(dx, dy) or 1
        extras.append(
            f"<path d='M {x + dx / n_ * 3:.1f},{y + dy / n_ * 3:.1f} L {x + dx:.1f},{y + dy:.1f}' {trait}/>"
        )
        extras.append(_texte(x + dx * 1.45, y + dy * 1.45 + 4.5, texte, 13))
        w = _largeur_texte(texte, 13)
        points += [(x + dx * 1.45 - w / 2, y + dy * 1.45 - 8), (x + dx * 1.45 + w / 2, y + dy * 1.45 + 8)]

    for ancre, dx, dy in spec.radicaux:
        x, y = pos[cartes[ancre]].x + dx, pos[cartes[ancre]].y + dy
        extras.append(f"<circle cx='{x:.1f}' cy='{y:.1f}' r='2.1' style='fill:#000000;stroke:none'/>")
        points += [(x - 3, y - 3), (x + 3, y + 3)]

    for ancre, x1, y1, x2, y2 in spec.traits:
        x, y = pos[cartes[ancre]].x, pos[cartes[ancre]].y
        extras.append(f"<path d='M {x + x1:.1f},{y + y1:.1f} L {x + x2:.1f},{y + y2:.1f}' {trait}/>")
        points += [(x + x1, y + y1), (x + x2, y + y2)]

    for atomes, cote in spec.arcs:
        pts = [pos[cartes[n]] for n in atomes]
        a, b, c = pts[0], pts[len(pts) // 2], pts[-1]
        dx, dy = c.x - a.x, c.y - a.y
        n_ = math.hypot(dx, dy) or 1
        nx, ny = -dy / n_ * cote, dx / n_ * cote
        a2 = (a.x + nx * 7, a.y + ny * 7)
        c2 = (c.x + nx * 7, c.y + ny * 7)
        b2 = (b.x + nx * 9, b.y + ny * 9)
        ctl = (2 * b2[0] - (a2[0] + c2[0]) / 2, 2 * b2[1] - (a2[1] + c2[1]) / 2)
        extras.append(f"<path d='M {a2[0]:.1f},{a2[1]:.1f} Q {ctl[0]:.1f},{ctl[1]:.1f} {c2[0]:.1f},{c2[1]:.1f}' {trait}/>")
        points += [a2, c2, ctl]

    for atomes, entier in spec.cercles:
        cycle = [pos[cartes[n]] for n in atomes]
        cx = sum(q.x for q in cycle) / len(cycle)
        cy = sum(q.y for q in cycle) / len(cycle)
        R = sum(math.hypot(q.x - cx, q.y - cy) for q in cycle) / len(cycle) * 0.58
        if entier:
            extras.append(f"<circle cx='{cx:.1f}' cy='{cy:.1f}' r='{R:.1f}' {trait}/>")
        else:
            def sur(q):
                u, v = q.x - cx, q.y - cy
                k = R / (math.hypot(u, v) or 1)
                return cx + u * k, cy + v * k
            (xa, ya), (xb, yb) = sur(cycle[0]), sur(cycle[-1])
            # Le sens est celui qui passe par l'atome du milieu de la liste.
            tour = 2 * math.pi
            a0 = math.atan2(ya - cy, xa - cx)
            a1 = math.atan2(yb - cy, xb - cx)
            am = math.atan2(cycle[len(cycle) // 2].y - cy, cycle[len(cycle) // 2].x - cx)
            d_fin, d_mil = (a1 - a0) % tour, (am - a0) % tour
            if d_mil < d_fin:
                balayage, grand = 1, int(d_fin > math.pi)
            else:
                balayage, grand = 0, int(tour - d_fin > math.pi)
            extras.append(
                f"<path d='M {xa:.1f},{ya:.1f} A {R:.1f},{R:.1f} 0 {grand} {balayage} {xb:.1f},{yb:.1f}' {trait}/>"
            )

    xmin = min([0.0] + [q[0] for q in points])
    ymin = min([0.0] + [q[1] for q in points])
    xmax = max([L] + [q[0] + 2 for q in points])
    ymax = max([H] + [q[1] + 2 for q in points])
    contenu = f"<g transform='translate({-xmin:.1f},{-ymin:.1f})'>{corps}{''.join(extras)}</g>"
    return Bloc(contenu, xmax - xmin, ymax - ymin)


def mm(smiles: str, **options) -> Bloc:
    return dessiner_meca(Meca(smiles, **options))


def equilibre(dessus: list[str] = (), dessous: list[str] = (), minimum=56) -> Bloc:
    largeur = max([minimum] + [_largeur_texte(t, 12) + 12 for t in [*dessus, *dessous]])
    ligne_ = 15
    haut = len(dessus) * ligne_ + 4
    bas = len(dessous) * ligne_ + 6
    y = haut + 3
    trait = "style='fill:none;stroke:#000000;stroke-width:1.3px'"
    corps = (
        f"<path d='M 4,{y - 3:.1f} L {largeur - 4:.1f},{y - 3:.1f} L {largeur - 11:.1f},{y - 8:.1f}' {trait}/>"
        f"<path d='M {largeur - 4:.1f},{y + 3:.1f} L 4,{y + 3:.1f} L 11,{y + 8:.1f}' {trait}/>"
    )
    for i, t in enumerate(dessus):
        corps += _texte(largeur / 2, (i + 1) * ligne_ - 3, t, 12)
    for i, t in enumerate(dessous):
        corps += _texte(largeur / 2, y + 6 + (i + 1) * ligne_ - 3, t, 12)
    return Bloc(corps, largeur, y + bas + 2)


def crochets(bloc: Bloc, exposant: str = "") -> Bloc:
    """Un intermédiaire entre crochets, comme dans l'ouvrage."""
    L, H = bloc.largeur + 16, bloc.hauteur + 8
    trait = "style='fill:none;stroke:#000000;stroke-width:1.2px'"
    corps = (
        f"<path d='M 5,0 L 0,0 L 0,{H:.1f} L 5,{H:.1f}' {trait}/>"
        f"<path d='M {L - 5:.1f},0 L {L:.1f},0 L {L:.1f},{H:.1f} L {L - 5:.1f},{H:.1f}' {trait}/>"
        f"<g transform='translate(8,4)'>{bloc.corps}</g>"
    )
    if exposant:
        corps += _texte(L + 6, 8, exposant, 12)
    return Bloc(corps, L + (10 if exposant else 0), H)


def cadre(texte: str, taille=13) -> Bloc:
    """Texte encadré : le produit libéré, comme « ROH » dans l'ouvrage."""
    w = _largeur_texte(texte, taille) + 14
    h = taille + 12
    corps = f"<rect x='0.5' y='0.5' width='{w:.1f}' height='{h:.1f}' style='fill:none;stroke:#000000;stroke-width:1.1px'/>"
    corps += _texte(w / 2, h / 2 + taille * 0.36, texte, taille)
    return Bloc(corps, w + 1, h + 1)


def plus() -> Bloc:
    return texte_seul(["+"], 15)


def pi_allyle(bas_gauche: str, bas_droite: str, metal: str = "Pd") -> Bloc:
    """Complexe π-allyle du schéma 4.57 : arc au-dessus, métal et ligands dessous."""
    trait = "style='fill:none;stroke:#000000;stroke-width:1.4px'"
    fin = "style='fill:none;stroke:#000000;stroke-width:1.1px'"
    corps = (
        f"<path d='M 24,26 L 36,16 L 48,26' {trait}/>"
        f"<path d='M 21,18 Q 36,-4 51,18' {fin}/>"
        f"<path d='M 36,20 L 36,34' {fin}/>"
        + _texte(36, 48, metal, 13)
        + f"<path d='M 30,52 L 22,60' {fin}/>"
        + f"<path d='M 42,52 L 50,60' {fin}/>"
        + _texte(16, 72, bas_gauche, 13)
        + _texte(56, 72, bas_droite, 13, ancre="start")
    )
    return Bloc(corps, 60 + _largeur_texte(bas_droite, 13), 76)


def libre(corps: str, largeur: float, hauteur: float) -> Bloc:
    return Bloc(corps, largeur, hauteur)


def place(bloc: Bloc, x: float, y: float) -> str:
    return f"<g transform='translate({x:.1f},{y:.1f})'>{bloc.corps}</g>"


def _pointe(x: float, y: float, ux: float, uy: float) -> str:
    bx, by = x - ux * 8, y - uy * 8
    return (
        f"<path d='M {x:.1f},{y:.1f} L {bx - uy * 4:.1f},{by + ux * 4:.1f} "
        f"L {bx + uy * 4:.1f},{by - ux * 4:.1f} Z' style='fill:#000000;stroke:none'/>"
    )


R = "R"
X = "X⁻"


def meca_tbu() -> Bloc:
    """Schéma 1.3, p. 4 — rupture acide d'un groupe tert-butyle (dessiné sur un ester)."""
    ester = {1: (0, 0.5), 2: (0.87, 0), 3: (0.87, -1), 4: (1.73, 0.5), 5: (2.6, 0), 10: (3.47, 0.5), 11: (3.3, -0.7), 12: (2.6, -1)}
    return cascade(
        mm("[*:1][C:2](=[O:3])[O:4][C:5]([CH3:10])([CH3:11])[CH3:12]", etiquettes={1: R}, places=ester),
        Eq(["+ HX", "− HX"]),
        mm(
            "[*:1][C:2](=[OH+:3])[O:4][C:5]([CH3:10])([CH3:11])[CH3:12]",
            etiquettes={1: R},
            places=ester,
            fleches=[((4, 5), (2, 4), 0.9), ((2, 3), 3, 1.0)],
            textes=[(3, 34, 6, X)],
        ),
        [],
        ligne(
            mm("[*:1][C:2](=[O:3])[OH:4]", etiquettes={1: R}, places={1: (0, 0), 2: (0.87, 0.5), 3: (0.87, 1.5), 4: (1.73, 0)}),
            plus(),
            crochets(ligne(mm("C[C+](C)C"), texte_seul([X], 13), espace=2)),
        ),
    )


def meca_acetal() -> Bloc:
    """Schéma 1.6, p. 5 — hydrolyse acide d'un O,O-acétal (2,2-diméthyl-1,3-dioxolane)."""
    cycle = {2: (1, 0), 1: (0.31, 0.95), 3: (0.31, -0.95), 6: (-0.81, 0.59), 7: (-0.81, -0.59), 8: (1.7, 0.7), 9: (1.7, -0.7)}
    return cascade(
        mm("[CH3:8][C:2]1([CH3:9])[O:1][CH2:6][CH2:7][O:3]1", places=cycle),
        Eq(["+ HX", "− HX"]),
        mm(
            "[CH3:8][C:2]1([CH3:9])[O:1][CH2:6][CH2:7][OH+:3]1",
            places=cycle,
            fleches=[(1, (1, 2), -0.9), ((2, 3), 3, -0.9)],
            textes=[(2, 62, 0, X)],
        ),
        Eq([]),
        mm("C[C:2](C)=[O+:1]CCO", textes=[(2, -4, -28, X)]),
        Eq(["+ H₂O", "− H₂O"]),
        mm("CC(C)([OH2+:3])OCCO", textes=[(3, 30, -16, X)]),
        Eq([]),
        mm(
            "[CH3:7][C:2]([CH3:8])([O:1][*:9])[OH+:3][CH2:5][CH2:6][OH:4]",
            etiquettes={9: "H"},
            places={2: (0, 0), 3: (-0.87, 0.5), 1: (0.87, 0.5), 9: (1.73, 0), 7: (0.5, -0.87), 8: (-0.5, -0.87), 5: (-1.73, 0), 6: (-2.6, 0.5), 4: (-3.46, 0)},
            fleches=[(1, (1, 2), 1.0), ((2, 3), 3, -1.0)],
            textes=[(3, -30, -26, X)],
        ),
        Eq(["+ HX", "− HX"]),
        ligne(mm("OCCO"), plus(), mm("CC(C)=O")),
    )


def meca_dithiane() -> Bloc:
    """Schéma 1.7, p. 6 — clivage d'un dithiocétal par HgCl₂ (sans flèches dans l'ouvrage)."""
    hexa = {1: (0, 0), 31: (-0.5, 0.87), 32: (-1.5, 0.87), 33: (-2, 0), 34: (-1.5, -0.87), 35: (-0.5, -0.87)}
    cyclo = "[CH2:31][CH2:32][CH2:33][CH2:34][CH2:35]"
    spiro = {**hexa, 2: (0.8, 0.6), 3: (0.8, -0.6), 4: (1.8, 0.75), 5: (2.4, 0), 6: (1.8, -0.75)}
    return cascade(
        mm(f"[C:1]78([S:2][CH2:4][CH2:5][CH2:6][S:3]8){cyclo}7", places=spiro),
        ["HgCl₂"],
        mm(
            f"[C:1]78([S:2][CH2:4][CH2:5][CH2:6][S+:3]8[Hg:8][Cl:9]){cyclo}7",
            places={**spiro, 8: (0.8, -1.6), 9: (1.6, -2.1)},
            textes=[(8, -44, 4, "Cl⁻")],
        ),
        [],
        mm(
            f"[C:1]7(=[S+:2][CH2:4][CH2:5][CH2:6][S:3][Hg:8][Cl:9]){cyclo}7",
            places={**hexa, 2: (1, 0), 4: (1.87, -0.5), 5: (1.87, -1.5), 6: (1.0, -2.0), 3: (1.0, -3.0), 8: (0.0, -3.2), 9: (-0.9, -3.6)},
            textes=[(2, 4, -24, "Cl⁻")],
        ),
        ["H₂O, − HCl"],
        mm(
            f"[OH:7][C:1]7([S:2][CH2:4][CH2:5][CH2:6][S:3][Hg:8][Cl:9]){cyclo}7",
            places={**hexa, 7: (0.5, 0.87), 2: (1, 0), 4: (1.87, -0.5), 5: (1.87, -1.5), 6: (1.0, -2.0), 3: (1.0, -3.0), 8: (0.0, -3.2), 9: (-0.9, -3.6)},
        ),
        [],
        mm(
            f"[OH:7][C:1]7([S+:2]9[CH2:4][CH2:5][CH2:6][S:3][Hg:8]9){cyclo}7",
            places={**hexa, 7: (0, 1.1), 2: (1, 0), 4: (1.6, -0.8), 5: (2.6, -0.6), 6: (2.9, 0.4), 3: (2.3, 1.2), 8: (1.3, 1.0)},
            textes=[(2, 26, -46, "Cl⁻")],
        ),
        ["− HCl"],
        ligne(mm("O=C1CCCCC1"), plus(), mm("S1CCCS[Hg]1")),
    )


def meca_fluorure() -> Bloc:
    """Schéma 1.8, p. 6 — fluorure et éther TBS : siliconate pentavalent (sans flèches)."""
    tbs = {
        1: (0, 0), 2: (0.5, 0.87), 3: (1.5, 0.87), 4: (1.5, 1.87), 6: (1.5, -0.13), 7: (2.4, 0.87),
        10: (0.8, 2.5), 11: (2.2, 2.5), 12: (1.5, 2.87),
    }
    tbu = "[C:4]([CH3:10])([CH3:11])[CH3:12]"
    return cascade(
        mm(f"[*:1][O:2][Si:3]([CH3:6])([CH3:7]){tbu}", etiquettes={1: R}, places=tbs),
        ["Bu₄NF"],
        crochets(
            ligne(
                texte_seul(["Bu₄N⁺"], 13),
                mm(
                    f"[*:1][O:2][Si-:3]([CH3:6])([CH3:7])([F:5]){tbu}",
                    etiquettes={1: R},
                    places={**tbs, 5: (2.5, 0.87), 7: (2.1, 0.25), 6: (1.2, 0.05)},
                ),
                espace=4,
            )
        ),
        [],
        texte_seul(["[R–O⁻][N⁺Bu₄]", "+", "t-BuMe₂SiF"], 13),
    )


def meca_sem() -> Bloc:
    """Schéma 1.10, p. 7 — fragmentation d'un éther SEM par le fluorure (HF, MeCN)."""
    chaine = {1: (-0.87, -0.5), 3: (0, 0), 4: (0.5, 0.87), 5: (0, 1.73), 6: (0.5, 2.6), 7: (0, 3.46), 8: (0.5, 4.33)}
    return cascade(
        mm(
            "[*:1][O:3][CH2:4][O:5][CH2:6][CH2:7][*:8]",
            etiquettes={1: R, 8: ("SiMe<sub>3</sub>", "Me<sub>3</sub>Si")},
            places=chaine,
        ),
        ["HF, MeCN"],
        crochets(
            mm(
                "[*:1][OH+:3][CH2:4][O:5][CH2:6][CH2:7][*:8][F:9]",
                etiquettes={1: R, 8: ("<sup>−</sup>SiMe<sub>3</sub>", "Me<sub>3</sub>Si<sup>−</sup>")},
                places={**chaine, 9: (0.5, 5.33)},
                fleches=[((8, 7), (7, 6), -1.0), ((6, 5), (5, 4), -1.0), ((4, 3), 3, -1.1)],
            )
        ),
        ["− H₂C=CH₂", "− HCHO", "− F-SiMe₃"],
        texte_seul(["ROH"], 14),
    )


def meca_tce() -> Bloc:
    """Schéma 1.11, p. 7 — élimination réductrice par le zinc (ester trichloroéthylique)."""
    chaine = {
        2: (0.87, 2.9), 4: (0.4, 2.0), 5: (0.87, 1.13), 6: (0.4, 0.27), 1: (-0.6, 0.27), 7: (0.9, -0.6),
        20: (0.1, 3.4), 21: (0.87, 3.9),
    }
    return cascade(
        mm(
            "[Cl:20][C:2]([Cl:21])([Cl:3])[CH2:4][O:5][C:6]([*:1])=[O:7]",
            etiquettes={1: R},
            places={**chaine, 3: (1.7, 3.4)},
        ),
        ["Zn⁰, HOAc"],
        crochets(
            mm(
                "[Cl:20][C:2]([Cl:21])([Zn:3][Cl:22])[CH2:4][O:5][C:6]([*:1])=[OH+:7]",
                etiquettes={1: R},
                places={**chaine, 3: (1.8, 3.3), 22: (2.8, 3.3)},
                fleches=[((3, 2), (2, 4), -1.0), ((4, 5), (5, 6), -1.0), ((6, 7), 7, 1.1)],
                textes=[(7, 34, 16, "AcO⁻")],
            )
        ),
        ["− Cl₂C=CH₂", "− ZnCl(OAc)"],
        mm("[*:1]C(=O)O", etiquettes={1: R}),
    )


# Un cycle à six, pointe en haut : haut, haut-droite, bas-droite, bas, bas-gauche, haut-gauche.
def hexagone(cartes: list[int], cx: float = 0, cy: float = 0, pointe_en_haut: bool = True) -> dict[int, tuple[float, float]]:
    angles = [90, 30, -30, -90, -150, 150] if pointe_en_haut else [180, 120, 60, 0, -60, -120]
    return {
        n: (cx + math.cos(math.radians(a)), cy + math.sin(math.radians(a)))
        for n, a in zip(cartes, angles)
    }


DDQ = "O=[C:51]1[C:52](C#N)=[C:53](C#N)[C:54](=O)[C:55](Cl)=[C:56]1Cl"
DDQ_RAD_ANION = "O=[C:51]1[C:52](C#N)[C:53](C#N)=[C:54]([O-])[C:55](Cl)=[C:56]1Cl"
DDQH_RAD = "O=[C:51]1[C:52](C#N)[C:53](C#N)=[C:54](O)[C:55](Cl)=[C:56]1Cl"
DDQH_ANION = "O=[C:51]1[C-:52](C#N)[C:53](C#N)=[C:54](O)[C:55](Cl)=[C:56]1Cl"
DDQH2 = "O[C:51]1=[C:52](C#N)[C:53](C#N)=[C:54](O)[C:55](Cl)=[C:56]1Cl"
DDQ_CYCLE = [51, 52, 53, 54, 55, 56]


def ddq(smiles: str, **options) -> Bloc:
    return mm(smiles, places=hexagone(DDQ_CYCLE), **options)


# Anneau du PMB, pointe latérale : gauche (C–OMe) … droite (C–CH₂OR)
PMB_CYCLE = [61, 62, 63, 64, 65, 66]


def pmb(smiles: str, **options) -> Bloc:
    places = {**hexagone(PMB_CYCLE, pointe_en_haut=False), **options.pop("places", {})}
    return mm(smiles, places=places, **options)


def meca_ddq() -> Bloc:
    """Schéma 1.13, p. 9 — oxydation d'un éther PMB par la DDQ."""
    # C61 porte OMe (à gauche), C64 porte le CH₂OR (à droite) ; C62-C63 en haut.
    gauche = cascade(
        pmb("C[O+]=[C:61]1[CH:62]=[CH:63][C:64](=[CH:70]O[*:1])[CH:65]=[CH:66]1", etiquettes={1: R}),
        ["+ H₂O, − H⁺"],
        pmb("CO[c:61]1[cH:62][cH:63][c:64]([CH:70](O)O[*:1])[cH:65][cH:66]1", etiquettes={1: R}),
        [],
        ligne(pmb("CO[c:61]1[cH:62][cH:63][c:64]([CH:70]=O)[cH:65][cH:66]1"), plus(), cadre("R-OH")),
    )
    droite = cascade(ddq(DDQH_ANION), ["+ H⁺"], ddq(DDQH2))
    etape = {**hexagone(PMB_CYCLE, 0, 2.6, pointe_en_haut=False), **hexagone(DDQ_CYCLE, 1.6, -1.4)}
    return cascade(
        ligne(pmb("CO[c:61]1[cH:62][cH:63][c:64]([CH2:70]O[*:1])[cH:65][cH:66]1", etiquettes={1: R}), plus(), ddq(DDQ)),
        ["SET"],
        ligne(
            pmb(
                "CO[C:61]1[CH:62]=[CH:63][C+:64]([CH:70]([*:5])O[*:1])[CH:65]=[CH:66]1",
                etiquettes={1: R, 5: "H"},
                fleches=[((70, 5), (70, 64), 0.9)],
                radicaux=[(61, 9, 0)],
            ),
            plus(),
            ddq(DDQ_RAD_ANION, radicaux=[(52, 8, -7)]),
        ),
        [],
        mm(
            "C[O:3][C:61]1[CH:62]=[CH:63][C:64](=[CH:70]O[*:9])[CH:65]=[CH:66]1." + DDQH_RAD,
            etiquettes={9: R},
            places=etape,
            fleches=[(3, (3, 61), -1.0), (61, 52, -0.35)],
            radicaux=[(61, 9, 0), (52, 8, -7)],
        ),
        [],
        ligne(gauche, droite, espace=18),
    )


def meca_birch() -> Bloc:
    """Schéma 1.14, p. 10 — coupure d'un éther benzylique par Na, NH₃."""
    # C11 ipso (bas-droite), C12 bas, C13 bas-gauche, C14 haut-gauche, C15 haut, C16 haut-droite
    cycle = {
        11: (0.87, -0.5), 12: (0, -1), 13: (-0.87, -0.5), 14: (-0.87, 0.5), 15: (0, 1), 16: (0.87, 0.5),
        10: (1.73, -1.0), 1: (1.73, -2.0),
    }
    ro = {1: ("OR", "RO")}
    anneau = "[C:11]1[CH:12][CH:13][CH:14][CH:15][CH:16]1"
    return cascade(
        mm("[*:1][CH2:10][c:11]1[cH:12][cH:13][cH:14][cH:15][cH:16]1", etiquettes=ro, places=cycle),
        ["Na⁰"],
        ligne(
            crochets(
                mm(f"[*:1][CH2:10]{anneau}", etiquettes=ro, places=cycle, cercles=[([11, 12, 13, 14, 15, 16], True)]),
                "•−",
            ),
            texte_seul(["Na⁺"], 13),
            espace=2,
        ),
        ["t-BuOH, − t-BuONa"],
        crochets(
            mm(
                "[*:1][CH2:10][C:11]1[C:12]([*:19])([*:20])[CH:13][CH:14][CH:15][CH:16]1",
                etiquettes={**ro, 19: "H", 20: "H"},
                places={**cycle, 19: (-0.5, -1.87), 20: (0.5, -1.87)},
                cercles=[([13, 14, 15, 16, 11], False)],
            ),
            "•",
        ),
        ["Na⁰"],
        mm(
            "[*:1][CH2:10][C:11]1=[CH:16][C:15]([*:17])([*:18])[CH:14]=[CH:13][C:12]1([*:19])[*:20]",
            etiquettes={**ro, 17: "H", 18: "Na", 19: "H", 20: "H"},
            places={**cycle, 17: (-0.5, 1.87), 18: (0.7, 1.8), 19: (-0.5, -1.87), 20: (0.5, -1.87)},
            fleches=[((15, 18), (15, 16), -1.0), ((16, 11), (11, 10), -0.9), ((10, 1), 1, -1.0)],
        ),
        [],
        ligne(
            mm(
                "[CH2:10]=[C:11]1[CH:16]=[CH:15][CH:14]=[CH:13][C:12]1([*:19])[*:20]",
                etiquettes={19: "H", 20: "H"},
                places={**cycle, 19: (-0.5, -1.87), 20: (0.5, -1.87)},
            ),
            plus(),
            texte_seul(["RONa"], 13),
        ),
        ["H₃O⁺, O₂"],
        ligne(mm("[CH3:10][c:11]1[cH:12][cH:13][cH:14][cH:15][cH:16]1", places=cycle), plus(), cadre("ROH")),
    )


def meca_rh() -> Bloc:
    """Schéma 1.16, p. 11 — isomérisation d'un éther allylique par Rh(I)."""
    ro = {1: ("OR", "RO")}
    return cascade(
        mm("[*:1][C:2]([*:9])C=C", etiquettes={**ro, 9: "H"}),
        Eq(["+ Rhᴵ", "− Rhᴵ"]),
        mm("[*:1][C:2]([*:9])[CH:3]=[CH2:4]", etiquettes={**ro, 9: "H"}, liens=[((3, 4), 0, 16, "Rhᴵ")]),
        Eq([]),
        mm(
            "[*:1][CH:2][CH:3][CH2:4]",
            etiquettes=ro,
            places={1: (0, 0), 2: (0.87, -0.5), 3: (1.73, 0), 4: (2.6, -0.5)},
            arcs=[([2, 3, 4], -1)],
            liens=[(3, 0, 28, "Rhᴵᴵᴵ")],
            traits=[(3, 0, 48, 0, 56)],
            textes=[(3, 0, 65, "H")],
        ),
        Eq([]),
        mm("[*:1][CH:2]=[CH:3][CH2:4][*:9]", etiquettes={**ro, 9: "H"}, liens=[((2, 3), 0, 16, "Rhᴵ")]),
        Eq(["− Rhᴵ", "+ Rhᴵ"]),
        mm("[*:1]C=CC", etiquettes=ro),
        ["+ H₃O⁺", "− EtCHO"],
        cadre("ROH"),
    )


def meca_pd() -> Bloc:
    """Schéma 4.57, p. 141 — cycle catalytique du Pd(0) (dessiné sur un ester allylique)."""
    ester = mm("[*:1]C(=O)OCC=C", etiquettes={1: R}, miroir_h=True)
    haut = pi_allyle("L", "OCOR")
    bas = pi_allyle("L", "Nu")
    allyle_nu = mm("C=CC[*:1]", etiquettes={1: "Nu"})
    pd0 = cadre("Pd(0)L")
    acide = cadre("RCOOH")
    xd = max(ester.largeur, allyle_nu.largeur) + 70  # colonne des complexes
    yb = 190
    corps = place(ester, 0, 8)
    corps += place(haut, xd, 0)
    corps += place(bas, xd, yb)
    corps += place(allyle_nu, 0, yb + 20)
    xm = xd - 45  # colonne de Pd(0)L
    corps += place(pd0, xm - pd0.largeur / 2, 105)
    corps += place(acide, xd + 70, 105)
    corps += _texte(xm + 32, 124, "+ NuH", 12, ancre="start")
    t = "style='fill:none;stroke:#000000;stroke-width:1.3px'"
    y1 = 30
    corps += f"<path d='M {ester.largeur + 6:.1f},{y1} L {xd - 10:.1f},{y1}' {t}/>" + _pointe(xd - 4, y1, 1, 0)
    corps += f"<path d='M {xm:.1f},103 L {xm:.1f},{y1 + 16} Q {xm:.1f},{y1} {xm + 14:.1f},{y1}' {t}/>"
    xv = xd + 36
    corps += f"<path d='M {xv:.1f},82 L {xv:.1f},{yb - 10}' {t}/>" + _pointe(xv, yb - 4, 0, 1)
    corps += f"<path d='M {xv:.1f},104 Q {xv:.1f},118 {xv + 22:.1f},118' {t}/>" + _pointe(xd + 68, 118, 1, 0)
    y2 = yb + 40
    corps += f"<path d='M {xd - 6:.1f},{y2} L {allyle_nu.largeur + 10:.1f},{y2}' {t}/>" + _pointe(
        allyle_nu.largeur + 4, y2, -1, 0
    )
    corps += f"<path d='M {xm + 14:.1f},{y2} Q {xm:.1f},{y2} {xm:.1f},{y2 - 16} L {xm:.1f},{105 + pd0.hauteur + 10:.1f}' {t}/>"
    corps += _pointe(xm, 105 + pd0.hauteur + 3, 0, -1)
    return Bloc(corps, xd + 70 + acide.largeur, yb + bas.hauteur)


MECANISMES = {
    "meca-tbu": meca_tbu,
    "meca-acetal": meca_acetal,
    "meca-dithiane": meca_dithiane,
    "meca-fluorure": meca_fluorure,
    "meca-sem": meca_sem,
    "meca-tce": meca_tce,
    "meca-ddq": meca_ddq,
    "meca-birch": meca_birch,
    "meca-rh": meca_rh,
    "meca-pd": meca_pd,
}


def main() -> None:
    structures = {cle: seule(cle) for cle in M}
    structures.update(schemas())
    structures.update({cle: svg(f()) for cle, f in MECANISMES.items()})

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
