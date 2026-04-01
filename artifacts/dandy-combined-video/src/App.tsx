import VideoTemplate from "@/components/video/VideoTemplate";
import DownloadButton from "@/components/DownloadButton";

export default function App() {
  return (
    <div className="w-full h-screen overflow-hidden" style={{ background: '#001a14' }}>
      <VideoTemplate />
      <DownloadButton />
    </div>
  );
}
