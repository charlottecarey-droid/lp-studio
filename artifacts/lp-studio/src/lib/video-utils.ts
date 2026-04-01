const VIDEO_EXTS = [".mp4", ".webm", ".ogg", ".mov"];

export function isNativeVideoUrl(url: string): boolean {
  const lower = url.toLowerCase().split("?")[0];
  return VIDEO_EXTS.some(ext => lower.endsWith(ext));
}

function appendParams(url: string, params: Record<string, string>): string {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }
  return u.toString();
}

export function getAutoplayEmbedUrl(url: string): string {
  if (!url) return url;
  if (isNativeVideoUrl(url)) return url;

  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");

    // YouTube watch → embed
    if (host === "youtube.com" && u.pathname === "/watch") {
      const id = u.searchParams.get("v");
      if (id) {
        return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}`;
      }
    }

    // youtu.be short link
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) {
        return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}`;
      }
    }

    // YouTube embed URL already
    if (host === "youtube.com" && u.pathname.startsWith("/embed/")) {
      const id = u.pathname.replace("/embed/", "");
      return appendParams(`https://www.youtube.com/embed/${id}`, {
        autoplay: "1", mute: "1", loop: "1", playlist: id,
      });
    }

    // Vimeo standard link
    if (host === "vimeo.com" && /^\/\d+/.test(u.pathname)) {
      const id = u.pathname.slice(1);
      return `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&loop=1`;
    }

    // Vimeo player embed already
    if (host === "player.vimeo.com" && u.pathname.startsWith("/video/")) {
      return appendParams(url, { autoplay: "1", muted: "1", loop: "1" });
    }

    // Loom share link
    if (host === "loom.com" && u.pathname.startsWith("/share/")) {
      const id = u.pathname.replace("/share/", "").split("?")[0];
      return `https://www.loom.com/embed/${id}?autoplay=1&hide_owner=true`;
    }

    // Loom embed already
    if (host === "loom.com" && u.pathname.startsWith("/embed/")) {
      return appendParams(url, { autoplay: "1" });
    }

    return url;
  } catch {
    return url;
  }
}
