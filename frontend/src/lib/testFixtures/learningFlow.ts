import partialRecognitionContract from "../../../../shared/test-fixtures/partial-recognition-contract.json";
import { getLessonPackage } from "../../data/lessonPackages";

export function learningFlowTask(
  lessonId: string,
  idSuffix: string,
  key: string,
  taskType: string,
  skillDomain: string | null,
  taskData: Record<string, any> = {},
) {
  return {
    id: `lf-test-${lessonId}-${idSuffix}`,
    key,
    taskType,
    sourceQueue: "CURRICULUM",
    lessonId,
    childId: 1,
    sessionId: undefined as string | undefined,
    skillDomain,
    state: "PENDING",
    required: true,
    itemId: `item-${idSuffix}`,
    taskData,
  };
}

// Planner-faithful LEARN task sets from backend/app/learning_flow.py::_session_plan.
export function plannerTasksForLesson(
  lessonId: "starter-l01" | "starter-l02" | "starter-l03" | "starter-l04" | "starter-l05" | "basic-l01" | "book1-l01",
  includeOptionalWriting = false,
  partialRecognition = false,
  childId = 1,
) {
  const tasks: ReturnType<typeof learningFlowTask>[] = [];
  if (lessonId === "starter-l04") {
    const pkg = getLessonPackage(lessonId)!;
    const stepData = (key: string) => pkg.taskBlueprint.learnSteps.find((step) => step.stepKey === key)!.data;
    const context = stepData("context");
    const pattern = stepData("sentence_pattern");
    const phonetics = stepData("exit_ticket");
    const speaking = stepData("speaking");
    const reflection = stepData("mini_check");
    const wrap = stepData("wrap_up");
    tasks.push({
      ...learningFlowTask(lessonId, "listen", "listen", "LISTENING", "listening", {
        text: context.audioText, locale: "zh-TW", textKind: "sentence", authorship: context.authorship,
      }),
      itemId: `lf_${childId}_${lessonId}_phrase`,
    });
    ["小", "狗"].forEach((character, index) => {
      const other = index === 0 ? "狗" : "小";
      tasks.push({
        ...learningFlowTask(lessonId, `recognition-${index + 1}`, `recognition-${index + 1}`, index === 0 ? "RECOGNITION" : "MINI_CHECK", "recognition", {
          prompt: "聽一聽發音，選出聽到的字：", audioText: character,
          choices: index === 0
            ? [{ id: "option-1", label: other }, { id: "option-2", label: character }]
            : [{ id: "option-1", label: character }, { id: "option-2", label: other }],
          authorship: "TONGXUAN_AUTHORED_PRACTICE",
        }),
        itemId: `lf_${childId}_${lessonId}_char_${index + 1}`,
      });
    });
    tasks.push({
      ...learningFlowTask(lessonId, "sentence", "sentence-pattern", "SENTENCE_PATTERN", null, {
        prompt: pattern.prompt, choices: pattern.choices!.map(({ id, label }: any) => ({ id, label })), authorship: pattern.authorship,
      }),
      itemId: null as any,
    });
    tasks.push({
      ...learningFlowTask(lessonId, "phonetics", "phonetics", "PHONETICS", "phonetics", {
        prompt: phonetics.prompt,
        questions: phonetics.questions!.map(({ id, character, script, choices }: any) => ({
          id, character, script, choices: choices.map(({ id: choiceId, label }: any) => ({ id: choiceId, label })),
        })),
        authorship: phonetics.authorship,
      }),
      itemId: null as any,
    });
    tasks.push({
      ...learningFlowTask(lessonId, "speaking", "speaking", "SPEAKING_ATTEMPT", "speaking", {
        text: speaking.speakingPrompt!.expectedText, locale: "zh-TW", textKind: "sentence", sourceType: "SENTENCE", audioPolicy: "LOCAL_ONLY", authorship: speaking.authorship,
      }),
      itemId: `lf_${childId}_${lessonId}_sentence`,
    });
    tasks.push(learningFlowTask(lessonId, "reflection", "mini-check-reflection", "MINI_CHECK", null, {
      mode: "reflection", prompt: reflection.prompt, choices: reflection.choices, authorship: reflection.authorship,
    }));
    tasks.push(learningFlowTask(lessonId, "wrap-up", "wrap-up", "LESSON_WRAP_UP", null, {
      label: wrap.wrapUpSummary!.completionText, masteryNotice: wrap.wrapUpSummary!.masteryNotice, authorship: wrap.authorship,
    }));
    for (const task of tasks) {
      task.childId = childId;
      task.sessionId = `test-session-${lessonId}`;
      task.id = `${task.sessionId}:${task.key}`;
    }
    return tasks;
  }
  if (lessonId === "starter-l05") {
    const pkg = getLessonPackage(lessonId)!;
    const stepData = (key: string) => pkg.taskBlueprint.learnSteps.find((step) => step.stepKey === key)!.data;
    const context = stepData("context");
    const vocabulary = stepData("vocabulary");
    const phonetics = stepData("exit_ticket");
    const speaking = stepData("speaking");
    const reflection = stepData("mini_check");
    const wrap = stepData("wrap_up");
    const questions = phonetics.questions!.map(({ id, character, script, choices }: any) => ({
      id, character, script, choices: choices.map(({ id: choiceId, label }: any) => ({ id: choiceId, label })),
    }));
    const tasks = [
      {
        ...learningFlowTask(lessonId, "listen", "listen", "LISTENING", "listening", {
          text: context.audioText, locale: "zh-TW", textKind: "sentence", authorship: context.authorship,
        }),
        itemId: `lf_${childId}_${lessonId}_phrase`,
      },
      {
        ...learningFlowTask(lessonId, "vocabulary", "vocabulary", "VOCABULARY", "vocabulary", {
          prompt: vocabulary.prompt, choices: vocabulary.choices!.map(({ id, label }: any) => ({ id, label })),
          wordText: vocabulary.word, pinyin: pkg.vocabulary[0].pronunciation.pinyin,
          zhuyin: pkg.vocabulary[0].pronunciation.zhuyin, exampleSentence: vocabulary.exampleSentence,
          authorship: vocabulary.authorship,
        }),
        itemId: `lf_${childId}_${lessonId}_vocabulary`,
      },
      {
        ...learningFlowTask(lessonId, "phonetics", "phonetics", "PHONETICS", "phonetics", {
          prompt: phonetics.prompt, questions, authorship: phonetics.authorship,
        }),
        itemId: null as any,
      },
      {
        ...learningFlowTask(lessonId, "speaking", "speaking", "SPEAKING_ATTEMPT", "speaking", {
          text: speaking.speakingPrompt!.expectedText, locale: "zh-TW", textKind: "sentence",
          sourceType: "SENTENCE", audioPolicy: "LOCAL_ONLY", authorship: speaking.authorship,
        }),
        itemId: `lf_${childId}_${lessonId}_sentence`,
      },
      learningFlowTask(lessonId, "reflection", "mini-check-reflection", "MINI_CHECK", null, {
        mode: "reflection", prompt: reflection.prompt, choices: reflection.choices, authorship: reflection.authorship,
      }),
      learningFlowTask(lessonId, "wrap-up", "wrap-up", "LESSON_WRAP_UP", null, {
        label: wrap.wrapUpSummary!.completionText, masteryNotice: wrap.wrapUpSummary!.masteryNotice, authorship: wrap.authorship,
      }),
    ];
    for (const task of tasks) {
      task.childId = childId;
      task.sessionId = `test-session-${lessonId}`;
      task.id = `${task.sessionId}:${task.key}`;
    }
    return tasks;
  }
  if (lessonId === "starter-l02" || lessonId === "starter-l03") {
    const pkg = getLessonPackage(lessonId)!;
    const stepData = (key: string) => pkg.taskBlueprint.learnSteps.find((step) => step.stepKey === key)!.data;
    const context = stepData("context");
    const vocab = stepData("vocabulary");
    const phonetics = stepData("exit_ticket");
    const speaking = stepData("speaking");
    const reflection = stepData("mini_check");
    const wrap = stepData("wrap_up");
    tasks.push({
      ...learningFlowTask(lessonId, "listen", "listen", "LISTENING", "listening", {
        text: context.audioText, locale: "zh-TW", textKind: lessonId === "starter-l03" ? "sentence" : "character", authorship: context.authorship,
      }),
      itemId: `lf_${childId}_${lessonId}_phrase`,
    });
    tasks.push({
      ...learningFlowTask(lessonId, "vocabulary", "vocabulary", "VOCABULARY", "vocabulary", {
        prompt: vocab.prompt, choices: vocab.choices!.map(({ id, label }: any) => ({ id, label })),
        wordText: vocab.word, pinyin: pkg.vocabulary[0].pronunciation.pinyin, zhuyin: pkg.vocabulary[0].pronunciation.zhuyin,
        exampleSentence: vocab.exampleSentence, correctChoiceId: vocab.correctChoiceId, authorship: vocab.authorship,
      }),
      itemId: `lf_${childId}_${lessonId}_vocabulary`,
    });
    tasks.push({
      ...learningFlowTask(lessonId, "phonetics", "phonetics", "PHONETICS", "phonetics", {
        prompt: phonetics.prompt,
        questions: phonetics.questions!.map(({ id, character, script, choices }: any) => ({
          id, character, script, choices: choices.map(({ id: choiceId, label }: any) => ({ id: choiceId, label })),
        })),
        authorship: phonetics.authorship,
      }),
      itemId: null as any,
    });
    tasks.push({
      ...learningFlowTask(lessonId, "speaking", "speaking", "SPEAKING_ATTEMPT", "speaking", {
        text: speaking.speakingPrompt!.expectedText, locale: "zh-TW", textKind: "sentence", sourceType: "SENTENCE", audioPolicy: "LOCAL_ONLY", authorship: speaking.authorship,
      }),
      itemId: `lf_${childId}_${lessonId}_sentence`,
    });
    tasks.push(learningFlowTask(lessonId, "reflection", "mini-check-reflection", "MINI_CHECK", null, {
      mode: "reflection", prompt: reflection.prompt ?? "你覺得今天的練習怎麼樣？",
      choices: reflection.choices ?? [{ id: "practiced", label: "我練習過了" }, { id: "more", label: "下次再練一次" }],
      authorship: reflection.authorship,
    }));
    tasks.push(learningFlowTask(lessonId, "wrap-up", "wrap-up", "LESSON_WRAP_UP", null, {
      label: wrap.wrapUpSummary!.completionText, masteryNotice: wrap.wrapUpSummary!.masteryNotice, authorship: wrap.authorship,
    }));
    for (const task of tasks) {
      task.childId = childId;
      task.sessionId = `test-session-${lessonId}`;
      task.id = `${task.sessionId}:${task.key}`;
    }
    return tasks;
  }
  tasks.push(learningFlowTask(lessonId, "listen", "listen", "LISTENING", "listening", { text: "你好", locale: "zh-TW", textKind: "character" }));

  if (lessonId === "starter-l01") {
    const questions = ["你", "好"].flatMap((character, index) => ["TRADITIONAL", "SIMPLIFIED"].map((script) => ({
      id: `${script.toLowerCase()}-${index + 1}`,
      character,
      script,
      choices: [{ id: "choice-a", label: "ㄋㄧˇ" }, { id: "choice-b", label: "nǐ" }],
    })));
    tasks.push(learningFlowTask(lessonId, "phonetics", "phonetics", "PHONETICS", "phonetics", { prompt: "把兩種注音／拼音對應到目標字。", questions }));
  }

  if (lessonId !== "starter-l01") {
    const chars = ["你", "好"];
    const indexes = partialRecognition
      ? [partialRecognitionContract.expectedFreshCharacterIndex - 1]
      : chars.map((_, index) => index);
    indexes.forEach((index) => {
      const recognitionIndex = index + 1;
      const key = partialRecognition ? partialRecognitionContract.task.key : `recognition-${recognitionIndex}`;
      const taskType = partialRecognition
        ? partialRecognitionContract.task.taskType
        : index === 0 ? "RECOGNITION" : "MINI_CHECK";
      const itemId = partialRecognitionContract.task.itemIdTemplate
        .replace("{child_id}", "1")
        .replace("{lesson_id}", lessonId)
        .replace("{index}", String(recognitionIndex));
      const task = learningFlowTask(
        lessonId,
        key,
        key,
        taskType,
        partialRecognitionContract.task.skillDomain,
        { prompt: "聽一聽發音，選出聽到的字：", audioText: chars[index], choices: [{ id: "option-1", label: chars[1 - index] }, { id: "option-2", label: chars[index] }] },
      );
      tasks.push({ ...task, itemId });
    });
  }

  if (lessonId === "basic-l01") {
    tasks.push(learningFlowTask(lessonId, "vocabulary", "vocabulary", "VOCABULARY", "vocabulary", {
      prompt: "選出數字詞的意思：", choices: [{ id: "opt-hello", label: "打招呼問好 (Hello)" }, { id: "opt-eat", label: "問對方吃飽沒 (Eat meal)" }],
    }));
  }
  if (lessonId === "book1-l01") {
    tasks.push(learningFlowTask(lessonId, "sentence", "sentence-pattern", "SENTENCE_PATTERN", null, {
      prompt: "排列正確的句子順序來打招呼：", choices: [{ id: "opt-correct-order", label: "你好！我叫大衛。" }, { id: "opt-wrong-order", label: "大衛！我叫你好。" }],
    }));
  }
  tasks.push(learningFlowTask(lessonId, "speaking", "speaking", "SPEAKING_ATTEMPT", "speaking", { text: "你好", locale: "zh-TW", textKind: "character" }));
  if (lessonId === "book1-l01") {
    tasks.push(learningFlowTask(lessonId, "pronunciation", "pronunciation", "PRONUNCIATION_ATTEMPT", "pronunciation", { text: "你好", locale: "zh-TW", textKind: "character" }));
  }
  if (includeOptionalWriting) {
    tasks.push({
      ...learningFlowTask(lessonId, "writing-guided", "writing-guided", "WRITING_GUIDED", "writing", { character: "你", phase: "guided", scriptMode: "TRADITIONAL" }),
      required: false,
    });
  }
  tasks.push(learningFlowTask(lessonId, "reflection", "mini-check-reflection", "MINI_CHECK", null, {
    mode: "reflection", prompt: "你覺得今天的練習怎麼樣？", choices: [{ id: "practiced", label: "我練習過了" }, { id: "more", label: "下次再練一次" }],
  }));
  tasks.push(learningFlowTask(lessonId, "wrap-up", "wrap-up", "LESSON_WRAP_UP", null, { label: "完成今天練習", masteryNotice: "精熟度會依各領域證據另外判定。" }));
  return tasks;
}

export function authoritativeSessionFixture(
  lessonId: "starter-l01" | "starter-l02" | "starter-l03" | "starter-l04" | "starter-l05" | "basic-l01" | "book1-l01",
  sessionId: string,
  states: Record<string, string> = {},
  taskOverrides: Record<string, Record<string, unknown>> = {},
  includeOptionalWriting = false,
  partialRecognition = false,
  childId = 1,
) {
  const tasks = plannerTasksForLesson(lessonId, includeOptionalWriting, partialRecognition, childId).map((task) => ({
    ...task,
    id: `${sessionId}:${task.key}`,
    sessionId,
    childId,
    state: states[task.key] ?? task.state,
    ...taskOverrides[task.key],
    taskData: { ...task.taskData, ...(taskOverrides[task.key]?.taskData as Record<string, unknown> | undefined) },
  }));
  return {
    id: sessionId,
    status: "IN_PROGRESS",
    lessonId,
    childId,
    sessionId,
    masteryStatus: "IN_PROGRESS",
    curriculumContext: {
      lessonId,
      lessonMasteredBeforeSession: false,
      stageTitle: ["starter-l01", "starter-l02", "starter-l03", "starter-l04", "starter-l05"].includes(lessonId) ? "入門冊" : lessonId === "basic-l01" ? "基礎冊" : "第一冊",
      official: { title: lessonId === "starter-l02" ? "我七歲" : lessonId === "starter-l03" ? "爸爸媽媽" : lessonId === "starter-l04" ? "小狗" : lessonId === "starter-l05" ? "我的妹妹" : lessonId === "basic-l01" ? "數字一到十" : "你好" },
    },
    tasks,
  };
}
