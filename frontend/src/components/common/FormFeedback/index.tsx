import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FormFeedbackProps {
	id?: string;
	message: string | null;
}

const FormFeedback = ({ id, message }: FormFeedbackProps) => {
	if (!message) return null;

	return (
		<Alert
			id={id}
			variant="destructive"
			className="border-destructive/25 bg-destructive/5"
			aria-live="assertive"
		>
			<AlertCircle aria-hidden="true" />
			<AlertDescription>{message}</AlertDescription>
		</Alert>
	);
};

export default FormFeedback;
