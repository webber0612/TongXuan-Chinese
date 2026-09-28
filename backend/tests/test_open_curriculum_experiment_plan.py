import hashlib
import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


ROOT = Path(__file__).resolve().parents[2]
PROPOSAL_PATH = ROOT / "shared" / "open-curriculum" / "proposals" / "prototype-peer-exchange-2026-09-v2.json"
OLD_PROPOSAL_PATH = ROOT / "shared" / "open-curriculum" / "proposals" / "prototype-five-weekday-2026-09.json"
DECISION_PATH = ROOT / "shared" / "open-curriculum" / "proposals" / "owner-decisions" / "prototype-five-weekday-2026-09-v1-revise.json"
PROPOSAL_SCHEMA_PATH = ROOT / "shared" / "open-curriculum" / "schemas" / "five-lesson-experiment-proposal.schema.json"
DECISION_SCHEMA_PATH = ROOT / "shared" / "open-curriculum" / "schemas" / "owner-decision-record.schema.json"
OLD_OWNER_HASH = "1bafad4a7db3b0af9cd5cda69284b73f6101edc64235d466390fb8f71c69f35a"


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_plan():
    return load_json(PROPOSAL_PATH)


def canonical_sha256(value):
    canonical = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def targets_by_id(plan):
    return {item["id"]: item for item in plan["candidateTargetCatalog"]}


def test_replacement_proposal_matches_schema_and_stays_non_executable():
    plan = load_plan()
    schema = load_json(PROPOSAL_SCHEMA_PATH)
    errors = list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(plan))

    assert errors == []
    assert plan["proposalId"] == "prototype-peer-exchange-2026-09-v2"
    assert plan["approvalStatus"] == "PROPOSED"
    assert plan["ownerDecision"] is None
    assert plan["scope"]["formalCourseClaim"] is False
    assert plan["scope"]["executableLessonsCreated"] is False
    assert plan["scope"]["approvedGraphMutated"] is False
    assert plan["scope"]["ocacMaterialConsulted"] is False
    assert plan["scope"]["writingTargets"] == []


def test_owner_revise_is_bound_to_the_immutable_exact_v1_hash():
    old = load_json(OLD_PROPOSAL_PATH)
    new = load_plan()
    decision = load_json(DECISION_PATH)
    schema = load_json(DECISION_SCHEMA_PATH)

    errors = list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(decision))

    assert errors == []
    assert canonical_sha256(old) == OLD_OWNER_HASH
    assert decision["proposalId"] == old["proposalId"] == "prototype-five-weekday-2026-09-v1"
    assert decision["proposalSha256"] == decision["advisoryReview"]["reviewedProposalSha256"] == OLD_OWNER_HASH
    assert decision["ownerDecision"]["decision"] == "REVISE"
    assert decision["advisoryReview"]["outcome"] == "PASS"
    assert decision["decisionEvidence"]["kind"] == "OWNER_AUTHORED_CHAT_MESSAGE"
    assert new["proposalId"] != old["proposalId"]
    assert new["ownerDecision"] is None


def test_five_lessons_each_add_a_distinct_cumulative_communicative_capability():
    plan = load_plan()
    targets = targets_by_id(plan)
    skills = {item["id"]: item for item in plan["skillCatalog"]}
    variants = {item["variantId"]: item for item in plan["variants"]}

    expected_skills = [
        "skill-greet-self-name",
        "skill-ask-answer-name",
        "skill-state-preference",
        "skill-ask-answer-preference",
        "skill-sustain-peer-exchange",
    ]
    expected_vocab = [
        {"vocab-nihao", "vocab-wo", "vocab-jiao"},
        {"vocab-ni", "vocab-shenme", "vocab-mingzi"},
        {"vocab-xihuan", "vocab-qiu"},
        set(),
        set(),
    ]
    expected_grammar = [
        {"grammar-self-name"},
        {"grammar-name-question"},
        {"grammar-state-preference"},
        {"grammar-ask-preference"},
        {"grammar-reciprocal-ne"},
    ]

    assert set(variants) == {"A", "B"}
    for variant in variants.values():
        assert variant["sequence"] == ["A", "B", "C", "D", "E"]
        assert len(variant["lessons"]) == 5
        assert [lesson["slot"] for lesson in variant["lessons"]] == ["A", "B", "C", "D", "E"]
        assert len({lesson["title"] for lesson in variant["lessons"]}) == 5

        prior_targets = set()
        prior_skills = set()
        for index, lesson in enumerate(variant["lessons"]):
            new_vocab = set(lesson["newVocabularyTargets"])
            new_grammar = set(lesson["newGrammarTargets"])
            new_chars = set(lesson["newCharacterTargets"])
            new_skill = set(lesson["skillTargets"]) - prior_skills

            assert new_vocab == expected_vocab[index]
            assert new_grammar == expected_grammar[index]
            assert new_skill == {expected_skills[index]}
            assert set(lesson["prerequisites"]) == prior_targets | prior_skills
            assert set(lesson["recycledTargetIds"]) == prior_targets
            assert new_vocab | new_grammar | new_chars
            assert set(lesson["vocabularyTargets"]) == prior_targets.intersection(
                target_id for target_id, target in targets.items() if target["targetType"] == "VOCABULARY"
            ) | new_vocab
            assert set(lesson["grammarTargets"]) == prior_targets.intersection(
                target_id for target_id, target in targets.items() if target["targetType"] == "GRAMMAR"
            ) | new_grammar
            assert set(lesson["characterTargets"]) == prior_targets.intersection(
                target_id for target_id, target in targets.items() if target["targetType"] == "CHARACTER"
            ) | new_chars

            for field in ("vocabularyTargets", "newVocabularyTargets", "visualMeaningComprehensionTargets"):
                assert all(targets[item]["targetType"] == "VOCABULARY" for item in lesson[field])
            for field in ("grammarTargets", "newGrammarTargets"):
                assert all(targets[item]["targetType"] == "GRAMMAR" for item in lesson[field])
            for field in ("characterTargets", "newCharacterTargets", "characterRecognitionTargets"):
                assert all(targets[item]["targetType"] == "CHARACTER" for item in lesson[field])
            assert set(lesson["scriptReadingTargets"]) <= set(lesson["vocabularyTargets"]) | set(lesson["grammarTargets"])

            load = lesson["load"]
            assert load["newVocabularyCount"] == len(new_vocab)
            assert load["newGrammarCount"] == len(new_grammar)
            assert load["newCharacterRecognitionCount"] == len(new_chars)
            assert load["newWritingCount"] == 0
            assert load["newPhoneticSyllableCount"] == len(lesson["phoneticTargetSyllables"])
            assert lesson["writingTargets"] == []

            prior_targets |= new_vocab | new_grammar | new_chars
            prior_skills |= new_skill

        assert [len(lesson["skillTargets"]) for lesson in variant["lessons"]] == [1, 2, 3, 4, 5]
        assert skills[expected_skills[1]]["prerequisites"] == [expected_skills[0]]
        assert skills[expected_skills[2]]["prerequisites"] == [expected_skills[1]]
        assert skills[expected_skills[3]]["prerequisites"] == [expected_skills[2]]
        assert set(skills[expected_skills[4]]["prerequisites"]) == {expected_skills[1], expected_skills[3]}


def test_variants_compare_real_recognition_strategies_over_the_same_curriculum():
    variants = {item["variantId"]: item for item in load_plan()["variants"]}
    a_chars = [len(lesson["newCharacterTargets"]) for lesson in variants["A"]["lessons"]]
    b_chars = [len(lesson["newCharacterTargets"]) for lesson in variants["B"]["lessons"]]

    assert a_chars == [0, 0, 0, 2, 3]
    assert b_chars == [1, 1, 1, 2, 3]
    assert [lesson["newVocabularyTargets"] for lesson in variants["A"]["lessons"]] == [
        lesson["newVocabularyTargets"] for lesson in variants["B"]["lessons"]
    ]
    assert [lesson["newGrammarTargets"] for lesson in variants["A"]["lessons"]] == [
        lesson["newGrammarTargets"] for lesson in variants["B"]["lessons"]
    ]
    assert not any(lesson["newCharacterTargets"] for lesson in variants["A"]["lessons"][:3])
    assert all(variants["B"]["lessons"][index]["newCharacterTargets"] for index in range(3))


def test_item_provenance_preserves_rights_and_distinguishes_framework_evidence():
    plan = load_plan()
    sources = {item["sourceId"]: item for item in plan["sourceCatalog"]}
    evidence = {item["evidenceId"]: item for item in plan["evidenceCatalog"]}

    assert sources["cc-cedict"]["status"] == "GREEN"
    assert sources["cc-cedict"]["license"] == "CC BY-SA 4.0"
    assert sources["tbcl-naer"]["status"] == "YELLOW"
    assert sources["tbcl-naer"]["useMode"] == "REFERENCE_ONLY"
    assert sources["tocfl-cccc"]["status"] == "YELLOW"
    assert sources["tocfl-cccc"]["useMode"] == "REFERENCE_ONLY"
    assert plan["licenseNotice"]["mitAppliesToCedictData"] is False
    assert all(item["approvalStatus"] == "PROPOSED" for item in plan["candidateTargetCatalog"])
    assert all(item["approvalStatus"] == "PROPOSED" for item in plan["skillCatalog"])
    assert evidence["ev-tbcl-l1"]["category"] == "OFFICIAL_LEVEL_FRAMEWORK"
    assert evidence["ev-tbcl-l2"]["category"] == "OFFICIAL_LEVEL_FRAMEWORK"
    assert evidence["ev-cccc-child-context"]["category"] == "CHILD_CONTEXT_REFERENCE"
    assert "UNRESOLVED" in evidence["ev-character-srs-unresolved"]["claim"]
    assert "frequency" in evidence["ev-tongxuan-hypothesis"]["claim"].lower()

    for target in plan["candidateTargetCatalog"]:
        assert target["whyThis"].strip()
        assert target["whyNow"].strip()
        assert target["evidenceIds"]
        assert target["sourceProvenance"]
        assert all(evidence_id in evidence for evidence_id in target["evidenceIds"])
        assert all(source["evidenceId"] in evidence for source in target["sourceProvenance"])
        assert all(source["rawContentIncluded"] is False for source in target["sourceProvenance"])
        assert target["confidence"]["limitations"]
        assert target["receptiveRequirement"]["evidenceIds"]
        assert target["productiveRequirement"]["evidenceIds"]
        if target["targetType"] == "VOCABULARY":
            cedict_sources = [source for source in target["sourceProvenance"] if source["sourceId"] == "cc-cedict"]
            assert len(cedict_sources) == 1
            assert cedict_sources[0]["license"] == "CC BY-SA 4.0"
            assert cedict_sources[0]["shareAlike"] is True
            assert "frequency" in evidence[cedict_sources[0]["evidenceId"]]["claim"].lower()


def test_srs_is_whole_word_only_and_character_srs_stays_unresolved():
    plan = load_plan()
    targets = targets_by_id(plan)
    for variant in plan["variants"]:
        prior_vocabulary = set()
        for lesson in variant["lessons"]:
            assert set(lesson["srsReviewTargets"]) == prior_vocabulary
            assert all(targets[item]["targetType"] == "VOCABULARY" for item in lesson["srsReviewTargets"])
            assert not (set(lesson["srsReviewTargets"]) & set(lesson["characterRecognitionTargets"]))
            prior_vocabulary.update(lesson["newVocabularyTargets"])


def test_schema_rejects_target_promotion_and_mit_relabeling_of_cc_cedict():
    plan = load_plan()
    schema = load_json(PROPOSAL_SCHEMA_PATH)

    promoted = json.loads(json.dumps(plan))
    promoted["candidateTargetCatalog"][0]["approvalStatus"] = "APPROVED"
    assert list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(promoted))

    relabeled = json.loads(json.dumps(plan))
    relabeled["licenseNotice"]["mitAppliesToCedictData"] = True
    assert list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(relabeled))
