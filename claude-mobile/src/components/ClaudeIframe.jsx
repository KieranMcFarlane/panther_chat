import React, { useRef, useEffect } from 'react';
import '../styles.css';

const ClaudeIframe = ({ mobile }) => {
  const iframeRef = useRef(null);
  const url = mobile
    ? 'https://sidffzirjjna.share.sandbox.dev?mobile=true'
    : 'https://sidffzirjjna.share.sandbox.dev?mobile=false';

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const handleTouch = (e) => e.stopPropagation();
    if (mobile) iframe.contentWindow?.document?.addEventListener('touchstart', handleTouch);
    return () => {
      if (mobile) iframe.contentWindow?.document?.removeEventListener('touchstart', handleTouch);
    };
  }, [mobile]);

  return (
    <div className={`claude-container ${mobile ? 'mobile' : 'desktop'}`}>
      <iframe
        ref={iframeRef}
        src={url}
        className="claude-iframe"
        title="ClaudeBox"
        style={{ border: '0', flex: 1 }}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-orientation-lock allow-presentation"
        allow="clipboard-read; clipboard-write; fullscreen; presentation; screen-orientation"
      />
    </div>
  );
};

export default ClaudeIframe;
