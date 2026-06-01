import { ShareReviewModal } from "@/components/collaboration/share-review-modal";
import { useReviews } from "@/hooks/use-collaboration";

export function ShareModalWrapper({ pageId, pageTitle, onClose }: { pageId: number; pageTitle: string; onClose: () => void }) {
  const { reviews, createReview, deleteReview, deleteReviews } = useReviews(pageId);
  return (
    <ShareReviewModal
      open
      onClose={onClose}
      pageId={pageId}
      pageName={pageTitle}
      reviews={reviews}
      onCreateReview={createReview}
      onDeleteReview={deleteReview}
      onDeleteReviews={deleteReviews}
    />
  );
}
