import { Dialog, DialogContent } from "@/components/ui/dialog";

const CHILIPIPER_URL = "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call";

interface DemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctaUrl?: string;
}

const DemoModal = ({ open, onOpenChange, ctaUrl }: DemoModalProps) => {
  const url = ctaUrl || CHILIPIPER_URL;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] h-[80vh] p-0 overflow-hidden">
        <iframe
          src={url}
          title="Schedule a Demo"
          className="w-full h-full border-0"
          allow="camera; microphone"
        />
      </DialogContent>
    </Dialog>
  );
};

export { CHILIPIPER_URL };
export default DemoModal;
