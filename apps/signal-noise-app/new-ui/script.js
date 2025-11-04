document.addEventListener('DOMContentLoaded', () => {
    // --- 1. SETUP ---
    const paths = Array.from(document.querySelectorAll('#background-svg path'));
    const changeBtn = document.getElementById('color-change-btn');
    const background = document.querySelector('.background-container');
    
    // Tracks the current direction of the animation. false = forward, true = reversed.
    let isReversed = false; 
    // Prevents clicks while an animation is in progress.
    let isAnimating = true; 

    // --- 2. CREATE THE MASTER TIMELINE ---
    // Callbacks now simply unlock the button when an animation is done.
    const masterTl = gsap.timeline({
        paused: true,
        onComplete: () => isAnimating = false, 
        onReverseComplete: () => isAnimating = false,
    });

    masterTl.from(paths, {
        opacity: 0,
        scale: 0,
        transformOrigin: '0% 100%',
        duration: 1.5,
        ease: 'sine.out',
        stagger: {
            from: "bottom-left",
            amount: 1.5,
        }
    });

    // Play the initial animation on page load.
    masterTl.play();

    // --- 3. HANDLE THE BUTTON CLICK (SIMPLE TOGGLE LOGIC) ---
    changeBtn.addEventListener('click', () => {
        // If an animation is already in progress, ignore the click.
        if (isAnimating) {
            return;
        }
        // Lock the button until the next animation finishes.
        isAnimating = true; 

        // Flip the state for the next click.
        isReversed = !isReversed;

        if (isReversed) {
            // If the state is now 'reversed', play the animation backwards.
            changeBtn.textContent = "Play Forward";
            gsap.to(background, { backgroundColor: "#E31B23", duration: masterTl.duration() });
            masterTl.reverse();
        } else {
            // If the state is now 'forward', play the animation forwards.
            changeBtn.textContent = "Reverse";
            gsap.to(background, { backgroundColor: "#FDEE00", duration: masterTl.duration() });
            masterTl.play();
        }
    });
});


// document.addEventListener('DOMContentLoaded', () => {
//     // --- 1. SETUP ---
//     const paths = Array.from(document.querySelectorAll('#background-svg path'));
//     const changeBtn = document.getElementById('color-change-btn');
//     const background = document.querySelector('.background-container');
    
//     let isReversed = false; // Tracks the current direction of the animation
//     let isAnimating = true; // Prevents clicks during animation

//     // --- 2. CREATE THE MASTER TIMELINE ---
//     // We add callbacks to know when the animation is finished playing or reversing.
//     const masterTl = gsap.timeline({
//         paused: true,
//         onComplete: () => isAnimating = false, // Allow clicks when forward animation is done
//         onReverseComplete: () => isAnimating = false, // Allow clicks when reverse is done
//     });

//     masterTl.from(paths, {
//         opacity: 0,
//         scale: 0,
//         transformOrigin: '0% 100%',
//         duration: 1.5,
//         ease: 'sine.out',
//         stagger: {
//             from: "bottom-left",
//             amount: 1.5,
//         }
//     });

//     // Play the initial animation on page load
//     masterTl.play();

//     // --- 3. HANDLE THE BUTTON CLICK (TOGGLE LOGIC) ---
//     changeBtn.addEventListener('click', () => {
//         // If an animation is already in progress, do nothing
//         if (isAnimating) return;
//         isAnimating = true; // Disable clicks until the next animation is done

//         // Flip the state for the next click
//         isReversed = !isReversed;

//         if (isReversed) {
//             // If it's reversed, change to red and play backwards
//             changeBtn.textContent = "Play Forward";
//             gsap.to(background, { backgroundColor: "#E31B23", duration: masterTl.duration() });
//             masterTl.reverse();
//         } else {
//             // If it's not reversed, change to yellow and play forwards
//             changeBtn.textContent = "Reverse";
//             gsap.to(background, { backgroundColor: "#FDEE00", duration: masterTl.duration() });
//             masterTl.play();
//         }
//     });
// });
