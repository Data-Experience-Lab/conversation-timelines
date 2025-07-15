import { SpeechToTopic } from "/conversation-timelines/js/speechController.js";

// swipe recognition
let touchStartX = null;
let touchEndX = null;
let touchStartY = null;
let touchEndY = null;
let hidden = false;

// Create class objects
let speechController = new SpeechToTopic();

const startRecognition = document.getElementById("startRecognition");
const increase = document.getElementById("increase");
const decrease = document.getElementById("decrease");
const secretButton = document.getElementById("vis-level-text");

startRecognition.addEventListener("click", function () {
  console.log("Transcribing");
  speechController.startContinuousRecording();
  startRecognition.style.display = "none";
  document.querySelector("#zoom").style.display = "flex";
  eventListeners();
});

increase.addEventListener("click", function () {
  console.log("increase");
  speechController.zoomIn();
});

decrease.addEventListener("click", function () {
  console.log("decrease");
  speechController.zoomOut();
});

secretButton.addEventListener("click", function () {
  console.log("secret button pressed!");
  speechController.download();
});

d3.select("#jumpToCurrent").on("click", function () {
  speechController.jumpToCurr();
});

// window.onload = speechController.startContinuousRecording();

// allow left and right arrow keys to press back and forward (for now)
document.onkeydown = function (e) {
  switch (e.keyCode) {
    case 27:
      if (!hidden) {
        console.log("Esc");
        speechController.escape();
      }
      break;
    case 76:
      if (!hidden) {
        console.log("L");
        speechController.escape();
      }
      break;
    case 37:
      if (!hidden) {
        console.log("Left");
        speechController.navBack();
      }
      break;
    case 38:
      if (!hidden) {
        console.log("Up");
        speechController.scrollUp();
      }
      break;
    case 39:
      if (!hidden) {
        console.log("Right");
        speechController.navForward();
      }
      break;
    case 40:
      if (!hidden) {
        console.log("Down");
        speechController.scrollDown();
      }
      break;
    case 75:
      console.log("K");
      speechController.toggleVis();
      break;
    case 78:
      // N
      speechController.zoomOut();
      break;
    case 77:
      // M
      console.log("M");
      speechController.timelineView();
      break;
    case 79:
      // O
      speechController.zoomIn();
      break;
    case 83:
      if (!hidden) {
        console.log("Jump to (S)");
        speechController.jumpToCurr();
      }
      break;
    case 189:
      console.log("ZoomOut");
      speechController.zoomOut();
      break;
    case 187:
      console.log("ZoomIn");
      speechController.zoomIn();
      break;
  }
};


// Mobile Controlls

function eventListeners() {
  let touchStartTime;
  let lastTapTime = 0;
  let singleTapTimeout;
  let targetDiv = document.querySelector("#clickable-area"); // Change to your target div class
  let topDiv = document.querySelector(".info-container"); // Change to your target div class

  targetDiv.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
      touchStartTime = Date.now();
    },
    { passive: false }
  );

  targetDiv.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].clientX;
    touchEndY = e.changedTouches[0].clientY;
    const touchEndTime = Date.now();

    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;
    const dt = touchEndTime - touchStartTime;

    const distance = Math.sqrt(dx * dx + dy * dy);

    const maxTapDistance = 10;
    const maxTapDuration = 300;
    const minSwipeDistance = 30;
    const maxDoubleTapDelay = 300;

    if (distance < maxTapDistance && dt < maxTapDuration) {
      if (touchEndTime - lastTapTime < maxDoubleTapDelay) {
        clearTimeout(singleTapTimeout); // Cancel pending single tap
        console.log("🚀 Double Tap event detected");
        speechController.toggleVis();
        lastTapTime = 0; // Reset to avoid triple tap issues
      } else {
        lastTapTime = touchEndTime;
        singleTapTimeout = setTimeout(() => {
          console.log("👆 Single Tap event detected");
          speechController.timelineView();
        }, maxDoubleTapDelay); // Wait before executing single tap
      }
    } else if (distance > minSwipeDistance) {
      console.log("Swipe event detected");
      checkDirection(); // `this` is now correctly inherited
    }
  });
}

// swipe recognition
function checkDirection() {
  let xDiff = touchEndX - touchStartX;
  let yDiff = touchEndY - touchStartY;
  console.log(`xdiff: ${xDiff}`);
  console.log(`ydiff: ${yDiff}`);
  if (Math.abs(xDiff) > Math.abs(yDiff)) {
    if (touchEndX < touchStartX) {
      speechController.navBack();
      console.log("swipe right");
    }
    if (touchEndX > touchStartX) {
      speechController.navForward();
      console.log("swipe left");
    }
  }
  if (Math.abs(yDiff) > Math.abs(xDiff)) {
    if (touchEndY < touchStartY) {
      speechController.scrollUp();
      console.log("swipe up");
    }
    if (touchEndY > touchStartY) {
      speechController.scrollDown();
      console.log("swipe down");
    }
  }
}
