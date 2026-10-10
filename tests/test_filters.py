from parsing.filters import PageStats, should_skip_page


def test_near_empty_page_is_skipped():
    decision = should_skip_page(
        PageStats(
            page_no=1,
            text_length=10,
            num_tables=0,
            num_figures=0,
            num_formulas=0,
        )
    )
    assert decision.skipped is True
    assert decision.reason == "near_empty"


def test_full_page_image_is_skipped():
    decision = should_skip_page(
        PageStats(
            page_no=2,
            text_length=50,
            num_tables=0,
            num_figures=1,
            num_formulas=0,
            page_area=1000.0,
            largest_figure_area=700.0,
        )
    )
    assert decision.skipped is True
    assert decision.reason == "full_page_image"


def test_content_page_is_kept():
    decision = should_skip_page(
        PageStats(
            page_no=3,
            text_length=500,
            num_tables=1,
            num_figures=1,
            num_formulas=1,
            page_area=1000.0,
            largest_figure_area=200.0,
        )
    )
    assert decision.skipped is False
    assert decision.reason is None


def test_title_slide_heuristic():
    decision = should_skip_page(
        PageStats(
            page_no=4,
            text_length=60,
            num_tables=0,
            num_figures=1,
            num_formulas=0,
        )
    )
    assert decision.skipped is True
    assert decision.reason in {"near_empty_with_image", "title_or_divider_slide"}


def test_title_only_cover_without_figures_is_skipped():
    decision = should_skip_page(
        PageStats(
            page_no=5,
            text_length=56,
            num_tables=0,
            num_figures=0,
            num_formulas=0,
        )
    )
    assert decision.skipped is True
    assert decision.reason == "title_or_divider_slide"
