import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { t } from "@/utils/i18n";

type BrandMarkProps = {
	className?: string;
	compact?: boolean;
};

const BrandMark = ({ className, compact = false }: BrandMarkProps) => (
	<Link
		to="/"
		className={cn(
			"inline-flex min-h-11 items-center text-foreground focus-visible:rounded-sm",
			className,
		)}
		aria-label={t("nav.logo")}
	>
		<span
			className={cn(
				"font-heading text-lg font-semibold tracking-[-0.01em]",
				compact && "text-base",
			)}
		>
			{t("nav.logo")}
		</span>
	</Link>
);

export default BrandMark;
