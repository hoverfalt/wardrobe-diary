"""The published JSON-LD (web/public/def/*.jsonld, generated from semantics/) parses as RDF with the
standard vocabularies (R-40): SKOS glossary, DCAT catalog, RDFS/OWL ontology, metrics."""
from pathlib import Path

import pytest
from rdflib import Graph, Namespace, URIRef
from rdflib.namespace import DCAT, OWL, RDF, RDFS, SKOS

DEF = Path(__file__).resolve().parents[2] / "web" / "public" / "def"
SITE = "https://wardrobediary.io"
PROV = Namespace("http://www.w3.org/ns/prov#")


def graph(name: str) -> Graph:
    return Graph().parse(DEF / f"{name}.jsonld", format="json-ld")


@pytest.mark.parametrize("name", ["ontology", "glossary", "metrics", "catalog"])
def test_parses_with_absolute_iris(name):
    g = graph(name)
    assert len(g) > 50
    for s, p, o in g:
        for node in (s, p, o):
            if isinstance(node, URIRef):
                assert str(node).startswith(("http://", "https://")), node


def test_glossary_is_a_skos_scheme():
    g = graph("glossary")
    concepts = set(g.subjects(RDF.type, SKOS.Concept))
    assert URIRef(f"{SITE}/glossary#cost-per-wear") in concepts
    assert all(g.value(c, SKOS.definition) and g.value(c, SKOS.prefLabel) for c in concepts)


def test_catalog_has_datasets_with_lineage():
    g = graph("catalog")
    datasets = set(g.subjects(RDF.type, DCAT.Dataset))
    public = URIRef(f"{SITE}/data#public-data")
    assert public in datasets
    assert URIRef(f"{SITE}/data#garments") in set(g.objects(public, PROV.wasDerivedFrom))


def test_ontology_aligns_with_schema_org():
    g = graph("ontology")
    garment = URIRef(f"{SITE}/model#class-Garment")
    assert (garment, RDF.type, OWL.Class) in g
    assert URIRef("https://schema.org/Product") in set(g.objects(garment, RDFS.subClassOf))
