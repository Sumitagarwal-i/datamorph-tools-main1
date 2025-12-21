import React from 'react';

interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
  className?: string;
  aspectRatio?: 'video' | 'square';
}

/**
 * YouTubeEmbed - Reusable component for embedding YouTube videos
 * Converts a YouTube URL or video ID to an embedded iframe
 */
export function YouTubeEmbed({ 
  videoId, 
  title = 'YouTube video player',
  className = 'w-full',
  aspectRatio = 'video'
}: YouTubeEmbedProps) {
  const aspectRatioClass = aspectRatio === 'square' ? 'aspect-square' : 'aspect-video';
  
  return (
    <div className={`${className} ${aspectRatioClass} rounded-lg overflow-hidden bg-black`}>
      <iframe
        width="100%"
        height="100%"
        src={`https://www.youtube.com/embed/${videoId}`}
        title={title}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="w-full h-full"
      />
    </div>
  );
}
