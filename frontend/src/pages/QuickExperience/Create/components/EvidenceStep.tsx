import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import FileUpload from "@/components/business/FileUpload";
import { Button } from "@/components/ui/button";
import type { UploadFile } from "@/types/upload";
import { MAX_IMAGE_COUNT } from "@/utils/constants";
import { t } from "@/utils/i18n";

type EvidenceStepProps = {
	files: UploadFile[];
	isSubmitting: boolean;
	onChange: (files: UploadFile[]) => void;
	onPrevious: () => void;
	onSubmit: () => void;
};

export const EvidenceStep = ({
	files,
	isSubmitting,
	onChange,
	onPrevious,
	onSubmit,
}: EvidenceStepProps) => (
	<motion.div
		key="step2"
		initial={{ opacity: 0 }}
		animate={{ opacity: 1 }}
		exit={{ opacity: 0 }}
		transition={{ duration: 0.15 }}
	>
		<h1 className="mb-4 text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-foreground">
			{t("quickCreate.step3.title")}
		</h1>
		<p className="mb-8 max-w-2xl text-base leading-7 text-muted-foreground">
			{t("quickCreate.step3.subtitle")}
		</p>
		<div className="border border-border bg-surface p-5 md:p-8">
			<FileUpload
				value={files}
				onChange={onChange}
				maxCount={MAX_IMAGE_COUNT}
			/>
		</div>
		<div className="mt-10 flex items-center gap-4">
			<Button
				variant="outline"
				size="lg"
				onClick={onPrevious}
				className="px-6 text-base"
			>
				{t("quickCreate.step.prev")}
			</Button>
			<Button
				size="lg"
				onClick={onSubmit}
				disabled={isSubmitting}
				className="px-8 text-base"
			>
				{isSubmitting ? (
					<span className="flex items-center gap-2">
						<Loader2 className="size-4 animate-spin" />
						{t("quickCreate.submitting")}
					</span>
				) : (
					t("quickCreate.submitAndAnalyze")
				)}
			</Button>
		</div>
	</motion.div>
);
