from parsing.converter import parse_page_range


def test_parse_page_range_variants():
    assert parse_page_range(None, 5) == [1, 2, 3, 4, 5]
    assert parse_page_range("1-3", 10) == [1, 2, 3]
    assert parse_page_range("1,3,5", 10) == [1, 3, 5]
    assert parse_page_range("8-10", 9) == [8, 9]
    assert parse_page_range("3-1", 5) == [1, 2, 3]
