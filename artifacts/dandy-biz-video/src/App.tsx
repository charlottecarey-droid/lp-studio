import VideoTemplate from "@/components/video/VideoTemplate";
import DownloadButton from "@/components/DownloadButton";

export default function App() {
  return (
    <div className="w-full h-screen overflow-hidden">
      <VideoTemplate />
      <DownloadButton />
    </div>
  );
}
