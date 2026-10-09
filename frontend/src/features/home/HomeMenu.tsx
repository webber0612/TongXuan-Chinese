import type { ReactNode } from "react";
import { ChevronRight, Cloud, Gift, Info, Lock, Sparkles, Trophy, Users } from "lucide-react";
import type { ChildLearner, DisplayLang, HandMode, PhoneticAssist, ScriptMode } from "../childPortal/types";
import type { HomeTranslate } from "./homeCopy";
import { Sheet } from "./Sheet";

type LegacyTranslate = (key: string, values?: Record<string, string | number>) => string;

export type MenuDestination = "switch-learner" | "rewards" | "achievements" | "sync" | "parent" | "setup" | "about";

interface HomeMenuProps {
  learner: ChildLearner;
  scriptMode: ScriptMode;
  phoneticAssist: PhoneticAssist;
  handMode: HandMode;
  displayLang: DisplayLang;
  isDarkEyeCare: boolean;
  copy: HomeTranslate;
  t: LegacyTranslate;
  onScriptMode: (mode: ScriptMode) => void;
  onPhoneticAssist: (mode: PhoneticAssist) => void;
  onHandMode: (mode: HandMode) => void;
  onDisplayLang: (lang: DisplayLang) => void;
  onToggleEyeCare: () => void;
  onNavigate: (destination: MenuDestination) => void;
  onClose: () => void;
}

const DISPLAY_LANGUAGES: Array<{ value: DisplayLang; label: string }> = [
  { value: "zh-Hant", label: "繁體中文" },
  { value: "zh-Hans", label: "简体中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "es", label: "Español" },
];

interface SegmentProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

function Segment<T extends string>({ label, value, options, onChange }: SegmentProps<T>) {
  return (
    <div className="tx-setting" role="group" aria-label={label}>
      <span className="tx-setting-label">{label}</span>
      <div className="tx-segment">
        {options.map((option) => (
          <button key={option.value} type="button" className="tx-segment-option" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MenuLink({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" className="tx-menu-link" onClick={onClick}>
      <span className="tx-menu-link-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}

/** Legacy labels carry decorative emoji; the menu supplies its own icons, so keep only the words. */
function plain(label: string): string {
  return label.replace(/^[^\p{L}\p{N}]+/u, "");
}

/** Everything that is not today's lesson lives here, so the home screen keeps one primary action. */
export function HomeMenu(props: HomeMenuProps) {
  const { learner, copy, onNavigate } = props;
  const t: LegacyTranslate = (key, values) => plain(props.t(key, values));
  return (
    <Sheet title={copy("menuTitle", { name: learner.name })} closeLabel={copy("close")} onClose={props.onClose}>
      <div className="tx-menu-learner">
        <span className="tx-avatar tx-avatar-large" aria-hidden="true">{learner.avatar}</span>
        <div>
          <strong>{learner.name}</strong>
          <small>{copy("starsAria", { n: learner.points?.stars ?? 0 })} · 🪙 {learner.points?.coins ?? 0}</small>
        </div>
      </div>

      <nav className="tx-menu-links" aria-label={copy("menuMore")}>
        <MenuLink icon={<Gift size={20} />} label={t("rewardsShop")} onClick={() => onNavigate("rewards")} />
        <MenuLink icon={<Trophy size={20} />} label={t("myAchievements")} onClick={() => onNavigate("achievements")} />
        <MenuLink icon={<Users size={20} />} label={t("switchUser")} onClick={() => onNavigate("switch-learner")} />
        <MenuLink icon={<Cloud size={20} />} label={copy("menuSync")} onClick={() => onNavigate("sync")} />
      </nav>

      <section className="tx-menu-section" aria-labelledby="tx-menu-learning">
        <h3 id="tx-menu-learning" className="tx-menu-heading">{copy("menuLearning")}</h3>
        <Segment
          label={t("scriptModeLabel")}
          value={props.scriptMode}
          onChange={props.onScriptMode}
          options={[
            { value: "zhuyin", label: t("scriptZhuyinShort") },
            { value: "pinyin", label: t("scriptPinyinShort") },
            { value: "dual", label: t("scriptDualShort") },
          ]}
        />
        <Segment
          label={t("phoneticAssistLabel")}
          value={props.phoneticAssist}
          onChange={props.onPhoneticAssist}
          options={[
            { value: "zhuyin", label: t("assistZhuyinShort") },
            { value: "pinyin", label: t("assistPinyinShort") },
            { value: "off", label: t("assistOffShort") },
          ]}
        />
        <Segment
          label={t("handModeLabel")}
          value={props.handMode}
          onChange={props.onHandMode}
          options={[
            { value: "right", label: t("handRight") },
            { value: "left", label: t("handLeft") },
          ]}
        />
        <Segment
          label={t("eyeCareMode")}
          value={props.isDarkEyeCare ? "dark" : "light"}
          onChange={(next) => { if ((next === "dark") !== props.isDarkEyeCare) props.onToggleEyeCare(); }}
          options={[
            { value: "light", label: t("eyeCareLightShort") },
            { value: "dark", label: t("eyeCareDarkShort") },
          ]}
        />
        <label className="tx-setting">
          <span className="tx-setting-label">{t("displayLangLabel")}</span>
          <select className="tx-select" value={props.displayLang} onChange={(event) => props.onDisplayLang(event.target.value as DisplayLang)}>
            {DISPLAY_LANGUAGES.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}
          </select>
        </label>
      </section>

      <nav className="tx-menu-links" aria-label={t("parentZone")}>
        <MenuLink icon={<Lock size={20} />} label={t("parentZone")} onClick={() => onNavigate("parent")} />
        <MenuLink icon={<Sparkles size={20} />} label={copy("menuSetupAgain")} onClick={() => onNavigate("setup")} />
        <MenuLink icon={<Info size={20} />} label={copy("menuAbout")} onClick={() => onNavigate("about")} />
      </nav>
    </Sheet>
  );
}
