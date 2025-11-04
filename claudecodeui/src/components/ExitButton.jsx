import React from 'react';

/**
 * ExitButton Component
 * 
 * A fixed-position button that allows users to gracefully exit the claude-console-ui.
 * Positioned on the right side of the screen with smooth transitions.
 */
function ExitButton({ onExit, className = "" }) {
  const handleExit = () => {
    if (onExit) {
      onExit();
    } else {
      // Default behavior: try to close the window/tab
      if (window.opener) {
        // If opened in a popup, close the popup
        window.close();
      } else {
        // If in a regular tab, try to navigate away or show a message
        if (window.history.length > 1) {
          window.history.back();
        } else {
          // Fallback: show a message to the user
          alert('Please close this tab manually or use your browser\'s back button.');
        }
      }
    }
  };

  return (
    <div className={`fixed top-1/2 -translate-y-1/2 right-64 z-50 transition-all duration-150 ease-out ${className}`}>
      <button
        onClick={handleExit}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-l-md p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-lg"
        aria-label="Exit Claude Console UI"
        title="Exit Claude Console UI"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="lucide lucide-chevron-right h-5 w-5 text-gray-600 dark:text-gray-400" 
          aria-hidden="true"
        >
          <path d="m9 18 6-6-6-6"></path>
        </svg>
      </button>
    </div>
  );
}

export default ExitButton;




