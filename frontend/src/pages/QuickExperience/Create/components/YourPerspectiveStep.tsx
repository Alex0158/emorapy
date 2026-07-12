import { motion } from "framer-motion";
import StatementInput from "@/components/business/StatementInput";
import { Button } from "@/components/ui/button";
import { t } from "@/utils/i18n";

type YourPerspectiveStepProps = {
	value: string;
	canContinue: boolean;
	onChange: (value: string) => void;
	onNext: () => void;
};

export const YourPerspectiveStep = ({
	value,
	canContinue,
	onChange,
	onNext,
}: YourPerspectiveStepProps) => (
	<motion.div
		key="step0"
		initial={{ opacity: 0 }}
		animate={{ opacity: 1 }}
		exit={{ opacity: 0 }}
		transition={{ duration: 0.15 }}
	>
		<h1 className="mb-4 text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-foreground">
			{t("quickCreate.step1.title")}
		</h1>
		<p className="mb-8 max-w-2xl text-base leading-7 text-muted-foreground">
			{t("quickCreate.step1.subtitle")}
		</p>
		<StatementInput
			value={value}
			onChange={onChange}
			role="plaintiff"
			showGuide
			minLength={30}
		/>
		<div className="mt-8">
			<Button
				size="lg"
				onClick={onNext}
				disabled={!canContinue}
				className="px-8 text-base"
			>
				{t("quickCreate.step.next")}
			</Button>
		</div>
	</motion.div>
);
