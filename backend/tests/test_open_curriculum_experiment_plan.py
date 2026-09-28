import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


ROOT = Path(__file__).resolve().parents[2]
PLAN_PATH = ROOT / "shared" / "open-curriculum" / "proposals" / "prototype-five-weekday-2026-09.json"
SCHEMA_PATH = ROOT / "shared" / "open-curriculum" / "schemas" / "five-lesson-experiment-proposal.schema.json"
REQUIRED_SLOTS = {"A", "B", "C", "D", "E"}


def load_plan():
    return json.loads(PLAN_PATH.read_text(encoding="utf-8"))


def test_candidate_plan_matches_its_schema_and_stays_proposed():
    plan = load_plan()
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

    errors = list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(plan))

    assert errors == []
    assert plan["approvalStatus"] == "PROPOSED"
    assert plan["ownerDecision"] is None
    assert plan["scope"]["executableLessonsCreated"] is False
    assert plan["scope"]["approvedGraphMutated"] is False


def test_schema_rejects_promotion_or_relabeling_third_party_data_as_mit():
    plan = load_plan()
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

    promoted = json.loads(json.dumps(plan))
    promoted["candidateTargetCatalog"][0]["approvalStatus"] = "APPROVED"
    assert list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(promoted))

    relabeled = json.loads(json.dumps(plan))
    relabeled["licenseNotice"]["mitAppliesToCedictData"] = True
    assert list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(relabeled))


def test_variants_cover_the_five_distinct_slots_with_explicit_target_groups():
    plan = load_plan()
    target_ids = {
        item["id"]
        for item in plan["candidateTargetCatalog"]
    }
    skill_ids = {item["id"] for item in plan["skillCatalog"]}

    assert {item["variantId"] for item in plan["variants"]} == {"A", "B"}
    for variant in plan["variants"]:
        assert len(variant["lessons"]) == 5
        assert {lesson["slot"] for lesson in variant["lessons"]} == REQUIRED_SLOTS
        assert len(variant["sequence"]) == 5
        for lesson in variant["lessons"]:
            for field in (
                "skillTargets",
                "vocabularyTargets",
                "grammarTargets",
                "characterTargets",
                "listeningComprehensionTargets",
                "visualMeaningComprehensionTargets",
                "spokenProductionTargets",
                "characterRecognitionTargets",
                "scriptReadingTargets",
                "writingTargets",
            ):
                assert isinstance(lesson[field], list)
            assert set(lesson["skillTargets"]) <= skill_ids
            for field in (
                "vocabularyTargets",
                "grammarTargets",
                "characterTargets",
                "newVocabularyTargets",
                "newGrammarTargets",
                "newCharacterTargets",
                "recycledTargetIds",
                "listeningComprehensionTargets",
                "visualMeaningComprehensionTargets",
                "spokenProductionTargets",
                "characterRecognitionTargets",
                "scriptReadingTargets",
                "srsReviewTargets",
            ):
                assert set(lesson[field]) <= target_ids


def test_variants_are_explicitly_different_and_preserve_prerequisites():
    plan = load_plan()
    by_id = {item["variantId"]: item for item in plan["variants"]}

    assert by_id["A"]["sequence"] == ["A", "B", "C", "D", "E"]
    assert by_id["B"]["sequence"] == ["A", "B", "D", "C", "E"]
    b_lessons = {lesson["slot"]: lesson for lesson in by_id["B"]["lessons"]}
    assert "grammar-copula-is" in b_lessons["A"]["grammarTargets"]
    assert "grammar-copula-is" in b_lessons["A"]["listeningComprehensionTargets"]
    expected_lexical_and_grammar = {
        "vocab-today",
        "vocab-weekday-monday",
        "grammar-copula-is",
    }
    expected_characters = {
        "char-jin",
        "char-tian",
        "char-xing",
        "char-qi",
        "char-yi",
        "char-shi",
    }
    assert expected_lexical_and_grammar <= set(b_lessons["D"]["prerequisites"])
    assert expected_lexical_and_grammar | expected_characters <= set(b_lessons["C"]["prerequisites"])


def test_targets_keep_per_item_provenance_and_unapproved_status():
    plan = load_plan()
    sources = {item["sourceId"]: item for item in plan["sourceCatalog"]}
    evidence = {item["evidenceId"]: item for item in plan["evidenceCatalog"]}

    assert sources["cc-cedict"]["status"] == "GREEN"
    assert sources["cc-cedict"]["license"].startswith("CC BY-SA 4.0")
    assert sources["tbcl-naer"]["status"] == "YELLOW"
    assert sources["tbcl-naer"]["useMode"] == "REFERENCE_ONLY"
    assert sources["tocfl-cccc"]["useMode"] == "REFERENCE_ONLY"
    assert all(item["approvalStatus"] == "PROPOSED" for item in plan["candidateTargetCatalog"])
    assert all(item["approvalStatus"] == "PROPOSED" for item in plan["skillCatalog"])

    for target in [*plan["candidateTargetCatalog"], *plan["skillCatalog"]]:
        assert target["whyThis"].strip()
        assert target["evidenceIds"]
        assert target["sourceProvenance"]
        for evidence_id in target["evidenceIds"]:
            assert evidence_id in evidence
        for provenance in target["sourceProvenance"]:
            assert provenance["sourceId"] in sources or provenance["sourceId"] in {"tongxuan-proposal", "tongxuan-system"}
            assert provenance["evidenceId"] in evidence
            assert provenance["rawContentIncluded"] is False

    for target in plan["candidateTargetCatalog"]:
        assert target["whyNow"].strip()
        assert target["receptiveRequirement"]["description"].strip()
        assert target["productiveRequirement"]["description"].strip()
        cedict_sources = [
            source for source in target["sourceProvenance"]
            if source["sourceId"] == "cc-cedict"
        ]
        assert len(cedict_sources) == 1
        assert cedict_sources[0]["license"] == "CC BY-SA 4.0"
        assert cedict_sources[0]["shareAlike"] is True


def test_loads_count_new_targets_and_never_infer_writing():
    plan = load_plan()

    for variant in plan["variants"]:
        assert variant["alternatives"] if "alternatives" in variant else variant["risks"]
        assert variant["confidence"]["rating"] in {"LOW", "MEDIUM", "HIGH"}
        assert variant["adaptiveLearningFit"].strip()
        for lesson in variant["lessons"]:
            assert lesson["alternatives"]
            assert lesson["confidence"]["rating"] in {"LOW", "MEDIUM", "HIGH"}
            assert lesson["adaptiveLearningFit"].strip()
            load = lesson["load"]
            assert load["newVocabularyCount"] == len(lesson["newVocabularyTargets"])
            assert load["newGrammarCount"] == len(lesson["newGrammarTargets"])
            assert load["newCharacterRecognitionCount"] == len(lesson["newCharacterTargets"])
            assert load["newWritingCount"] == 0
            assert lesson["writingTargets"] == []
            assert lesson["scriptReadingTargets"] == []
    assert plan["scope"]["writingTargets"] == []


def test_character_srs_is_a_proposal_and_rights_are_not_mislabeled_mit():
    plan = load_plan()

    assert plan["licenseNotice"]["cedictLicense"] == "CC BY-SA 4.0"
    assert plan["licenseNotice"]["mitAppliesToCedictData"] is False
    assert any(
        "Per-character recognition review" in item["claim"]
        for item in plan["evidenceCatalog"]
    )
    for variant in plan["variants"]:
        assert any(lesson["srsReviewTargets"] for lesson in variant["lessons"])
    assert plan["ownerDecision"] is None
