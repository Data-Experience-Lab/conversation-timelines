//Hosted
import { SpeechToTopic } from "/conversation-timelines/js/speechController.js";

// swipe recognition
let touchStartX = null;
let touchEndX = null;
let touchStartY = null;
let touchEndY = null;
let sliderVal = 0;
// let hidden = false;

// Create class objects
let speechController = new SpeechToTopic();

const startRecognition = document.getElementById("startRecognition");
const increase = document.getElementById("increase");
const decrease = document.getElementById("decrease");

startRecognition.addEventListener("click", function () {
  console.log("Transcribing");
  speechController.startContinuousRecording();
  startRecognition.style.display = "none";
  // eventListeners();
  document.querySelector("#slider").style.display = "block"
});


d3.select("#jumpToCurrent").on("click", function () {
  speechController.jumpToCurr();
});

let slider = d3.sliderHorizontal()
    .min(-1)
    .max(0)
    .ticks(0)
    .step(0.0001)
    .width(700)
    .displayValue(false)
    .on('onchange', val => {
      console.log(Math.abs(val))
      speechController.setSliderZoom(Math.abs(val));
    });

d3.select("#slider")
    .style("width","90%")
    .style("margin-top", "0px")
    .append("svg")
    .attr("width", 1000)
    .attr("height", 100)
    .append("g")
    .attr("transform", "translate(40,10)")
    .call(slider);


// allow left and right arrow keys to press back and forward (for now)
document.onkeydown = function (e) {
  switch (e.keyCode) {
    case 27:
      // if (!hidden) {
        console.log("Esc");
        speechController.escape();
      // }
      break;
    case 76:
      // if (!hidden) {
        console.log("L");
        speechController.escape();
      // }
      break;
    case 37:
      // if (!hidden) {
        console.log("Right");
        slider.value([slider.value() - 0.02]);
        console.log(slider.value())
        speechController.zoomIn();
      // }
      break;
    case 38:
      // if (!hidden) {
        console.log("Up");
        speechController.scrollUp();
      // }
      break;
    case 39:
      // if (!hidden) {
        console.log("Left");
        console.log(slider.value())
        slider.value([slider.value() + 0.02]);
        speechController.zoomOut();
      // }
      break;
    case 40:
      // if (!hidden) {
        console.log("Down");
        speechController.scrollDown();
      // }
      break;
    // case 77:
    //   // M
    //   console.log("M");
    //   speechController.timelineView();
    //   break;
    case 83:
      // if (!hidden) {
        console.log("Jump to (S)");
        speechController.jumpToCurr();
      // }
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
      speechController.zoomOut();
      console.log("swipe right");
    }
    if (touchEndX > touchStartX) {
      speechController.zoomIn();
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
