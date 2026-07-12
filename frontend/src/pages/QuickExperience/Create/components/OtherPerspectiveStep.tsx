import { motion } from "framer-motion";
import StatementInput from "@/components/business/StatementInput";
import { Button } from "@/components/ui/button";
import { MIN_DEFENDANT_LENGTH } from "@/utils/constants";
import { t } from "@/utils/i18n";

type OtherPerspectiveStepProps = {
	value: string;
	onChange: (value: string) => void;
	onPrevious: () => void;
	onNext: () => void;
	onCollaborative: () => void;
};

export const OtherPerspectiveStep = ({
	value,
	onChange,
	onPrevious,
	onNext,
	onCollaborative,
}: OtherPerspectiveStepProps) => (
	<motion.div
		key="step1"
		initial={{ opacity: 0 }}
		animate={{ opacity: 1 }}
		exit={{ opacity: 0 }}
		transition={{ duration: 0.15 }}
	>
		<h1 className="mb-4 text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-foreground">
			{t("quickCreate.step2.title")}
		</h1>
		<p className="mb-5 max-w-2xl text-base leading-7 text-muted-foreground">
			{t("quickCreate.step2.subtitle")}
		</p>
		<div className="mb-8 border-l border-secondary pl-4 text-sm leading-6 text-muted-foreground">
			<p>{t("quickCreate.step2.handoffPrompt")}</p>
			<button
				type="button"
				onClick={onCollaborative}
				className="mt-2 min-h-11 font-semibold text-foreground underline decoration-border underline-offset-8 hover:decoration-primary"
			>
				{t("quickCreate.collaborativeAction")}
			</button>
		</div>
		<StatementInput
			value={value}
			onChange={onChange}
			role="defendant"
			showGuide
			allowEmpty
			minLength={MIN_DEFENDANT_LENGTH}
		/>
		<div className="mt-8 flex items-center gap-4">
			<Button
				variant="outline"
				size="lg"
				onClick={onPrevious}
				className="px-6 text-base"
			>
				{t("quickCreate.step.prev")}
			</Button>
			<Button size="lg" onClick={onNext} className="px-8 text-base">
				{t("quickCreate.step.next")}
			</Button>
		</div>
	</motion.div>
);
