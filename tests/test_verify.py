from backend.extraction.verify import verify

PAGES = [
    "Introduction. This protocol defines the stability program.",
    "Micro-\ncrystalline   cellulose Avicel PH-102 was selected over PH-101 because its larger\nmean particle size provides the flow required for direct compression.",
    "The ﬁrst three commercial batches will be placed on long-term stability.",
]


def test_exact_match():
    r = verify("This protocol defines the stability program.", PAGES)
    assert r["verified"] and r["page"] == 1


def test_whitespace_hyphenation_and_case():
    r = verify("Microcrystalline cellulose Avicel PH-102 was selected over PH-101 because its larger mean particle size", PAGES)
    assert r["verified"] and r["page"] == 2


def test_ligatures_and_wrong_page_corrected():
    r = verify("The first three commercial batches will be placed on long-term stability.", PAGES)
    assert r["verified"] and r["page"] == 3


def test_paraphrase_fails():
    r = verify("The company chose a coarser cellulose to make the powder flow better in compression.", PAGES)
    assert not r["verified"]


def test_curly_quotes():
    r = verify("“Introduction.” This protocol defines the stability program.", ['"Introduction." This protocol defines the stability program.'])
    assert r["verified"]


def test_offsets_point_at_original_text():
    r = verify("Microcrystalline cellulose Avicel PH-102 was selected", PAGES)
    original = PAGES[1][r["start"]:r["end"]]
    assert original.startswith("Micro-\ncrystalline") and original.endswith("selected")


def test_offsets_with_ligature():
    r = verify("The first three commercial batches", PAGES)
    assert PAGES[2][r["start"]:r["end"]] == "The ﬁrst three commercial batches"


def test_second_quote_on_same_page_gets_own_offsets():
    page = "Alpha beta gamma delta. Epsilon zeta eta theta iota kappa."
    a, b = verify("Alpha beta gamma delta.", [page]), verify("Epsilon zeta eta theta", [page])
    assert page[a["start"]:a["end"]] == "Alpha beta gamma delta."
    assert page[b["start"]:b["end"]] == "Epsilon zeta eta theta"
