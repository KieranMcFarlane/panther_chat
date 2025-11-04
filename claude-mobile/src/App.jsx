import React from 'react';
import ClaudeIframe from './components/ClaudeIframe';

const App = () => {
  const isMobile = window.innerWidth <= 768;
  return <ClaudeIframe mobile={isMobile} />;
};

export default App;
