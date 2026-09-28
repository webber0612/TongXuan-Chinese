import hashlib
import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


ROOT = Path(__file__).resolve().parents[2]
PROPOSAL_PATH = ROOT / "shared" / "open-curriculum" / "proposals" / "prototype-peer-exchange-2026-09-v4.json"
V3_PROPOSAL_PATH = ROOT / "shared" / "open-curriculum" / "proposals" / "prototype-peer-exchange-2026-09-v3.json"
V2_PROPOSAL_PATH = ROOT / "shared" / "open-curriculum" / "proposals" / "prototype-peer-exchange-2026-09-v2.json"
OLD_PROPOSAL_PATH = ROOT / "shared" / "open-curriculum" / "proposals" / "prototype-five-weekday-2026-09.json"
V1_DECISION_PATH = ROOT / "shared" / "open-curriculum" / "proposals" / "owner-decisions" / "prototype-five-weekday-2026-09-v1-revise.json"
V2_DECISION_PATH = ROOT / "shared" / "open-curriculum" / "proposals" / "owner-decisions" / "prototype-peer-exchange-2026-09-v2-revise.json"
V3_DECISION_PATH = ROOT / "shared" / "open-curriculum" / "proposals" / "owner-decisions" / "prototype-peer-exchange-2026-09-v3-revise.json"
V1_SCHEMA_PATH = ROOT / "shared" / "open-curriculum" / "schemas" / "five-lesson-experiment-proposal.schema.json"
PROPOSAL_SCHEMA_PATH = ROOT / "shared" / "open-curriculum" / "schemas" / "five-lesson-experiment-proposal-v2.schema.json"
DECISION_SCHEMA_PATH = ROOT / "shared" / "open-curriculum" / "schemas" / "owner-decision-record.schema.json"
OLD_OWNER_HASH = "1bafad4a7db3b0af9cd5cda69284b73f6101edc64235d466390fb8f71c69f35a"
V2_OWNER_HASH = "7877db1106d8fa69644e026648513a0d9eaa569d23a5860eb81e5ec76ab9d5be"
V3_OWNER_HASH = "b5ff4050fd107220926f15f403a2d68a0895f30694a628704d7faa594bafb097"


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_plan():
    return load_json(PROPOSAL_PATH)


def canonical_sha256(value):
    canonical = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def targets_by_id(plan):
    return {item["id"]: item for item in plan["candidateTargetCatalog"]}


def test_v4_proposal_matches_typed_relationship_schema_and_stays_non_executable():
    plan = load_plan()
    schema = load_json(PROPOSAL_SCHEMA_PATH)
    errors = list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(plan))

    assert errors == []
    assert plan["schemaVersion"] == "2.0"
    assert plan["proposalId"] == "prototype-peer-exchange-2026-09-v4"
    assert plan["approvalStatus"] == "PROPOSED"
    assert plan["ownerDecision"] is None
    assert plan["scope"]["formalCourseClaim"] is False
    assert plan["scope"]["executableLessonsCreated"] is False
    assert plan["scope"]["approvedGraphMutated"] is False
    assert plan["scope"]["ocacMaterialConsulted"] is False
    assert plan["scope"]["writingTargets"] == []


def test_owner_revise_records_are_bound_to_immutable_proposal_hashes():
    old = load_json(OLD_PROPOSAL_PATH)
    v2 = load_json(V2_PROPOSAL_PATH)
    v3 = load_json(V3_PROPOSAL_PATH)
    new = load_plan()
    decision_schema = load_json(DECISION_SCHEMA_PATH)
    v1_decision = load_json(V1_DECISION_PATH)
    v2_decision = load_json(V2_DECISION_PATH)
    v3_decision = load_json(V3_DECISION_PATH)

    for decision in (v1_decision, v2_decision, v3_decision):
        assert list(Draft202012Validator(decision_schema, format_checker=FormatChecker()).iter_errors(decision)) == []
        assert decision["ownerDecision"]["decision"] == "REVISE"
        assert decision["advisoryReview"]["outcome"] == "PASS"
        assert decision["decisionEvidence"]["kind"] == "OWNER_AUTHORED_CHAT_MESSAGE"

    assert canonical_sha256(old) == OLD_OWNER_HASH
    assert v1_decision["proposalId"] == old["proposalId"] == "prototype-five-weekday-2026-09-v1"
    assert v1_decision["proposalSha256"] == v1_decision["advisoryReview"]["reviewedProposalSha256"] == OLD_OWNER_HASH
    assert canonical_sha256(v2) == V2_OWNER_HASH
    assert list(Draft202012Validator(load_json(V1_SCHEMA_PATH), format_checker=FormatChecker()).iter_errors(v2)) == []
    assert v2_decision["proposalId"] == v2["proposalId"] == "prototype-peer-exchange-2026-09-v2"
    assert v2_decision["proposalSha256"] == v2_decision["advisoryReview"]["reviewedProposalSha256"] == V2_OWNER_HASH
    assert canonical_sha256(v3) == V3_OWNER_HASH
    assert v3_decision["proposalId"] == v3["proposalId"] == "prototype-peer-exchange-2026-09-v3"
    assert v3_decision["proposalSha256"] == v3_decision["advisoryReview"]["reviewedProposalSha256"] == V3_OWNER_HASH
    assert v3_decision["ownerDecision"]["rationale"].startswith("REVISE — L3 LEXICAL SELECTION ONLY.")
    selection_source = new["lexicalDecisionGates"][0]["selectionSource"]
    assert selection_source["recordId"] == v3_decision["recordId"]
    assert selection_source["sourceProposalId"] == v3_decision["proposalId"]
    assert selection_source["sourceProposalSha256"] == v3_decision["proposalSha256"] == V3_OWNER_HASH
    assert new["proposalId"] not in {old["proposalId"], v2["proposalId"], v3["proposalId"]}
    assert new["ownerDecision"] is None


def test_five_lessons_keep_the_accepted_cumulative_communicative_outcomes():
    plan = load_plan()
    targets = targets_by_id(plan)
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
        {"vocab-xihuan", "vocab-wanju"},
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


def test_variants_keep_the_same_strategy_except_the_required_l3_recognition_swap():
    variants = {item["variantId"]: item for item in load_plan()["variants"]}
    a_chars = [len(lesson["newCharacterTargets"]) for lesson in variants["A"]["lessons"]]
    b_chars = [len(lesson["newCharacterTargets"]) for lesson in variants["B"]["lessons"]]

    assert a_chars == [0, 0, 0, 2, 3]
    assert b_chars == [1, 1, 1, 1, 3]
    assert [lesson["newVocabularyTargets"] for lesson in variants["A"]["lessons"]] == [
        lesson["newVocabularyTargets"] for lesson in variants["B"]["lessons"]
    ]
    assert [lesson["newGrammarTargets"] for lesson in variants["A"]["lessons"]] == [
        lesson["newGrammarTargets"] for lesson in variants["B"]["lessons"]
    ]
    assert variants["B"]["lessons"][2]["newCharacterTargets"] == ["char-xi"]
    assert variants["B"]["lessons"][3]["newCharacterTargets"] == ["char-huan"]
    assert not any(lesson["newCharacterTargets"] for lesson in variants["A"]["lessons"][:3])


def test_prior_target_is_not_automatically_a_lesson_hard_prerequisite():
    plan = load_plan()
    variants = {item["variantId"]: item for item in plan["variants"]}
    expected_hard = {
        "A": set(),
        "B": set(),
        "C": set(),
        "D": set(),
        "E": {"skill-ask-answer-name", "skill-state-preference", "skill-ask-answer-preference"},
    }

    for variant in variants.values():
        for lesson in variant["lessons"]:
            hard_ids = {edge["targetId"] for edge in lesson["hardPrerequisites"]}
            assert hard_ids == expected_hard[lesson["slot"]]
            assert "prerequisites" not in lesson
            if lesson["slot"] != "A":
                assert lesson["pedagogicalPredecessors"]
            assert all(edge["rationale"].strip() for edge in lesson["hardPrerequisites"])

    # L5 is not a mechanical transitive closure over all four prior lesson skills.
    assert expected_hard["E"] != {
        "skill-greet-self-name",
        "skill-ask-answer-name",
        "skill-state-preference",
        "skill-ask-answer-preference",
    }


def test_each_hard_prerequisite_has_a_rationale_and_recycled_targets_need_not_be_hard():
    plan = load_plan()
    for variant in plan["variants"]:
        for lesson in variant["lessons"]:
            hard_ids = {edge["targetId"] for edge in lesson["hardPrerequisites"]}
            recycled_ids = set(lesson["recycledContext"])
            assert hard_ids <= recycled_ids | {"skill-ask-answer-name", "skill-state-preference", "skill-ask-answer-preference"}
            assert all(edge["targetId"] and edge["rationale"].strip() for edge in lesson["hardPrerequisites"])
            assert set(lesson["recycledTargetIds"]) <= recycled_ids
            if lesson["recycledTargetIds"]:
                assert any(target_id not in hard_ids for target_id in lesson["recycledTargetIds"])

    skills = {item["id"]: item for item in plan["skillCatalog"]}
    assert skills["skill-ask-answer-name"]["hardPrerequisites"] == []
    assert skills["skill-state-preference"]["hardPrerequisites"] == []
    assert skills["skill-ask-answer-preference"]["hardPrerequisites"] == []
    assert all(edge["rationale"].strip() for skill in skills.values() for edge in skill["hardPrerequisites"])


def test_pedagogical_sequence_and_assumed_known_scaffolds_are_nonblocking():
    plan = load_plan()
    for variant in plan["variants"]:
        l3 = variant["lessons"][2]
        l4 = variant["lessons"][3]
        assert [edge["lessonSlot"] for edge in l3["pedagogicalPredecessors"]] == ["B"]
        assert [edge["lessonSlot"] for edge in l4["pedagogicalPredecessors"]] == ["C"]
        assert l3["hardPrerequisites"] == []
        assert l4["hardPrerequisites"] == []
        assert "skill-ask-answer-name" in {entry["targetId"] for entry in l3["assumedKnown"]}
        assert "skill-state-preference" in {entry["targetId"] for entry in l4["assumedKnown"]}
        assert all(entry["scaffoldIfMissing"].strip() for lesson in (l3, l4) for entry in lesson["assumedKnown"])
        assert "skill-ask-answer-name" in l3["recycledContext"]
        assert "skill-state-preference" in l4["recycledContext"]


def test_fast_track_can_skip_nonessential_lessons_when_only_hard_prerequisites_are_met():
    plan = load_plan()
    variant = plan["variants"][0]
    l3, l5 = variant["lessons"][2], variant["lessons"][4]

    def entry_allowed(lesson, mastered_targets):
        return all(edge["targetId"] in mastered_targets for edge in lesson["hardPrerequisites"])

    # No L2 completion or prior-name exchange is needed for L3 preference expression.
    assert entry_allowed(l3, set())
    assert [edge["lessonSlot"] for edge in l3["pedagogicalPredecessors"]] == ["B"]
    # L5 can be offered when its exact three capabilities are known, regardless of lesson A–D completion markers.
    l5_hard = {edge["targetId"] for edge in l5["hardPrerequisites"]}
    assert l5_hard == {"skill-ask-answer-name", "skill-state-preference", "skill-ask-answer-preference"}
    assert entry_allowed(l5, l5_hard)
    assert not entry_allowed(l5, l5_hard - {"skill-state-preference"})


def test_fast_track_skipped_composition_inputs_are_scaffolded_or_taught_in_lesson():
    plan = load_plan()
    targets = targets_by_id(plan)
    for variant in plan["variants"]:
        for slot, grammar_id in (("C", "grammar-state-preference"), ("D", "grammar-ask-preference")):
            lesson = next(item for item in variant["lessons"] if item["slot"] == slot)
            assumed_ids = {entry["targetId"] for entry in lesson["assumedKnown"]}
            new_vocab_ids = set(lesson["newVocabularyTargets"])
            grammar = targets[grammar_id]
            required_components = {edge["targetId"] for edge in grammar["hardPrerequisites"]}

            # A fast-track learner may skip prior lessons. Every composition input
            # must therefore be taught in this lesson or explicitly scaffolded.
            assert required_components - new_vocab_ids <= assumed_ids
            assert all(edge["rationale"].strip() for edge in grammar["hardPrerequisites"])

    for variant in plan["variants"]:
        l3, l4 = variant["lessons"][2:4]
        l3_assumed = {entry["targetId"] for entry in l3["assumedKnown"]}
        l4_assumed = {entry["targetId"] for entry in l4["assumedKnown"]}
        assert "vocab-wo" in l3_assumed
        assert {"vocab-ni", "vocab-xihuan", "vocab-shenme"} <= l4_assumed


def test_l3_lexical_choice_is_owner_selected_and_keeps_a_direct_nominal_slot():
    plan = load_plan()
    targets = targets_by_id(plan)
    gate = plan["lexicalDecisionGates"][0]
    l3 = plan["variants"][0]["lessons"][2]
    grammar = targets["grammar-state-preference"]

    assert gate["status"] == "OWNER_CURRICULUM_DECISION"
    assert gate["selectedTargetId"] == "vocab-wanju"
    assert gate["selectionSource"]["type"] == "OWNER_CURRICULUM_DECISION"
    assert gate["selectionSource"]["sourceProposalSha256"] == V3_OWNER_HASH
    assert gate["lessonSlot"] == "C"
    assert "我喜歡" in gate["communicativeFrame"]
    assert grammar["candidateForm"] == "我喜歡＋玩具"
    assert l3["newVocabularyTargets"] == ["vocab-xihuan", "vocab-wanju"]
    assert l3["phoneticTargetSyllables"] == ["xǐ", "huan", "wán", "jù"]
    assert l3["load"]["newVocabularyCount"] == 2
    assert l3["load"]["newPhoneticSyllableCount"] == 4
    assert targets["vocab-wanju"]["candidateForm"] == "玩具"
    assert targets["vocab-wanju"]["pinyin"] == "wánjù"
    assert "Owner curriculum decision / TongXuan hypothesis" in targets["vocab-wanju"]["whyThis"]
    assert "does not establish that 玩具 is the best" in targets["vocab-wanju"]["whyThis"]
    assert "vocab-qiu" not in targets
    assert "char-qiu" not in targets
    assert {edge["targetId"] for edge in grammar["hardPrerequisites"]} == {"vocab-wo", "vocab-xihuan"}
    assert all(edge["rationale"].strip() for edge in grammar["hardPrerequisites"])

    for option in gate["options"]:
        assert option["directFrameProbe"] == f"我喜歡{option['form']}"
        assert option["requiresAdditionalGrammarTarget"] is False
        assert option["genericUseRequiresClassifier"] is False
        if option["form"] == "玩具":
            assert option["directNominalUse"] == "OWNER_DECISION_ACCEPTED"
            assert option["semanticBurden"] == "OWNER_DECISION_ACCEPTED_LOW"
        else:
            assert option["directNominalUse"] == "OWNER_REVIEW_REQUIRED"
        assert option["childFamiliarity"] == "UNVERIFIED"
        assert option["evidenceIds"]


def test_lexical_comparison_provenance_does_not_claim_frequency_or_child_familiarity():
    plan = load_plan()
    evidence = {item["evidenceId"]: item for item in plan["evidenceCatalog"]}
    gate = plan["lexicalDecisionGates"][0]
    forms = {option["form"] for option in gate["options"]}

    assert {"球", "玩具", "書", "遊戲", "電影"} == forms
    active_forms = {target["candidateForm"] for target in plan["candidateTargetCatalog"]}
    assert "玩具" in active_forms
    assert not (forms - {"玩具"}) & active_forms
    assert next(option for option in gate["options"] if option["form"] == "玩具")["directNominalUse"] == "OWNER_DECISION_ACCEPTED"
    for option in gate["options"]:
        for evidence_id in option["evidenceIds"]:
            record = evidence[evidence_id]
            assert record["sourceId"] == "cc-cedict"
            assert record["category"] == "OPEN_LEXICAL_ITEM"
            assert "does not establish" in record["claim"]
            assert record["rawContentIncluded"] is False
    assert "Owner selected 玩具" in gate["comparisonConclusion"]
    assert "not TBCL/CCCC/CC-CEDICT evidence" in gate["comparisonConclusion"]


def test_v4_changes_only_the_owner_selected_l3_lexical_target_and_derived_load():
    old = load_json(V3_PROPOSAL_PATH)
    new = load_plan()
    normalized = json.loads(json.dumps(new))

    assert canonical_sha256(old) == V3_OWNER_HASH
    normalized["proposalId"] = old["proposalId"]
    normalized["scope"]["contaminationAssessment"] = old["scope"]["contaminationAssessment"]
    normalized["licenseNotice"] = old["licenseNotice"]
    normalized["lexicalDecisionGates"] = old["lexicalDecisionGates"]
    normalized["evidenceCatalog"] = [item for item in normalized["evidenceCatalog"] if item["evidenceId"] != "ev-owner-decision-l3-wanju"]
    normalized["candidateTargetCatalog"] = [
        item for item in normalized["candidateTargetCatalog"] if item["id"] != "vocab-wanju"
    ]
    old_targets = {item["id"]: item for item in old["candidateTargetCatalog"]}
    normalized["candidateTargetCatalog"] = [
        old_targets[item["id"]] if item["id"] == "grammar-state-preference" else item
        for item in normalized["candidateTargetCatalog"]
    ]

    derived_fields = (
        "vocabularyTargets",
        "newVocabularyTargets",
        "recycledTargetIds",
        "listeningComprehensionTargets",
        "visualMeaningComprehensionTargets",
        "spokenProductionTargets",
        "srsReviewTargets",
        "recycledContext",
    )
    old_variants = {item["variantId"]: item for item in old["variants"]}
    for variant in normalized["variants"]:
        original_variant = old_variants[variant["variantId"]]
        variant["cognitiveLoadSummary"] = original_variant["cognitiveLoadSummary"]
        old_lessons = {item["slot"]: item for item in original_variant["lessons"]}
        for lesson in variant["lessons"]:
            original = old_lessons[lesson["slot"]]
            # Each downstream list contains the newly selected vocabulary only as a recycled target.
            for field in derived_fields:
                lesson[field] = [target_id for target_id in lesson[field] if target_id != "vocab-wanju"]
            if lesson["slot"] == "C":
                assert lesson["phoneticTargetSyllables"] == ["xǐ", "huan", "wán", "jù"]
                assert lesson["load"]["newVocabularyCount"] == original["load"]["newVocabularyCount"] + 1
                assert lesson["load"]["newPhoneticSyllableCount"] == original["load"]["newPhoneticSyllableCount"] + 1
            lesson["phoneticTargetSyllables"] = original["phoneticTargetSyllables"]
            lesson["load"] = original["load"]

    assert normalized == old


def test_selected_l3_noun_is_recycled_and_reviewed_after_introduction():
    plan = load_plan()
    for variant in plan["variants"]:
        lessons = {lesson["slot"]: lesson for lesson in variant["lessons"]}
        assert "vocab-wanju" in lessons["C"]["newVocabularyTargets"]
        for slot in ("D", "E"):
            lesson = lessons[slot]
            assert "vocab-wanju" in lesson["vocabularyTargets"]
            assert "vocab-wanju" in lesson["recycledContext"]
            assert "vocab-wanju" in lesson["recycledTargetIds"]
            assert "vocab-wanju" in lesson["srsReviewTargets"]


def test_item_provenance_preserves_rights_and_framework_evidence():
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
        assert "prerequisites" not in target
        assert all(edge["rationale"].strip() for edge in target["hardPrerequisites"])
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

    selected_without_owner_source = json.loads(json.dumps(plan))
    del selected_without_owner_source["lexicalDecisionGates"][0]["selectionSource"]
    assert list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(selected_without_owner_source))
