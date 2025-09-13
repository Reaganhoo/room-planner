// Room planner script with:
// - persistent selection (update selected works)
// - defaults for window/door/plug
// - furniture collision prevention
// - window auto-rotate when snapped to vertical wall

const canvas = document.getElementById("gridCanvas");
const ctx = canvas.getContext("2d");

let roomWidth = 20, roomLength = 20;       // in feet
let objects = [];                          // stored objects
let selectedObject = null;                 // persistent selection for editing
let dragObject = null;                     // object being dragged
let offsetX = 0, offsetY = 0;
const SCALE = 30;                          // px per foot (fixed cell size)

// global counters
const typeCounters = {
    furniture: 0,
    window: 0,
    door: 0,
    plug: 0
  };
  

// ------------------------- DRAW -------------------------
function drawGrid() {
  // Resize canvas to room size (1ft = SCALE px)
  canvas.width = roomWidth * SCALE;
  canvas.height = roomLength * SCALE;

  const roomPixelW = canvas.width;
  const roomPixelH = canvas.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // grid lines
  ctx.strokeStyle = "#e6e6e6";
  for (let x = 0; x <= roomWidth; x++) {
    ctx.beginPath();
    ctx.moveTo(x * SCALE, 0);
    ctx.lineTo(x * SCALE, roomPixelH);
    ctx.stroke();
  }
  for (let y = 0; y <= roomLength; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * SCALE);
    ctx.lineTo(roomPixelW, y * SCALE);
    ctx.stroke();
  }

  // border
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, roomPixelW, roomPixelH);

  // draw objects
  objects.forEach(obj => {
    // determine draw width/height (px). For windows we visually rotate on vertical walls by swapping.
    if(obj.shape === "rect") {
    let drawW = obj.width * SCALE;
    let drawH = obj.height * SCALE;


    // color based on type
    ctx.fillStyle =
      obj.type === "furniture" ? "rgba(0,150,255,0.5)" :
      obj.type === "window" ? "rgba(0,200,0,0.55)" :
      obj.type === "door" ? "rgba(200,150,0,0.55)" :
      "rgba(200,0,200,0.55)"; // plug

    ctx.fillRect(obj.x, obj.y, drawW, drawH);
    ctx.strokeStyle = "#000";
    ctx.strokeRect(obj.x, obj.y, drawW, drawH);

    // label
    ctx.fillStyle = "#000";
    ctx.font = "12px Arial";
    ctx.fillText(obj.name, obj.x + 3, obj.y + 12);
    }
    else if (obj.shape === "quadrant") {
      const w = obj.width * SCALE;
      const h = obj.height * SCALE;
      const r = Math.min(w, h);            // radius of the quarter-circle (px)
    
      // compute pivot (center of the circle) and angles
      let cx, cy, start, end;
      if (obj.orientation === 0) {          // top-left
        cx = obj.x; cy = obj.y;
        start = 0; end = Math.PI / 2;
      } else if (obj.orientation === 1) {   // top-right
        cx = obj.x + w; cy = obj.y;
        start = Math.PI / 2; end = Math.PI;
      } else if (obj.orientation === 2) {   // bottom-right
        cx = obj.x + w; cy = obj.y + h;
        start = Math.PI; end = 3 * Math.PI / 2;
      } else {                              // orientation === 3 -> bottom-left
        cx = obj.x; cy = obj.y + h;
        start = 3 * Math.PI / 2; end = 2 * Math.PI;
      }
    
      ctx.beginPath();
      ctx.moveTo(cx, cy);                   // go to pivot
      ctx.arc(cx, cy, r, start, end);       // quarter arc (90°)
      ctx.closePath();                      // closes back to pivot
      ctx.fill();
      ctx.stroke();
    }
    
  });
}

// ------------------------- HELPERS -------------------------
function getDefaults(type) {
  if (type === "window") return { width: 4, height: 2 };
  if (type === "door") return { width: 3, height: 3 };
  if (type === "plug") return { width: 1, height: 1 };
  return { width: 3, height: 3 };
}

function clamp(val, a, b) { return Math.max(a, Math.min(b, val)); }

// wall side calculation using stored width/height in px (note: windows drawn swapped visually,
// but we decide wall by stored values and position)
function getWallSide(obj) {
  const roomPixelW = roomWidth * SCALE;
  const roomPixelH = roomLength * SCALE;
  const objWpx = obj.width * SCALE;
  const objHpx = obj.height * SCALE;

  if (obj.x === 0) return 'left';
  if (Math.abs(obj.x + (objWpx) - roomPixelW) < 1e-6) return 'right';
  if (obj.y === 0) return 'top';
  if (Math.abs(obj.y + (objHpx) - roomPixelH) < 1e-6) return 'bottom';
  return 'floating';
}

// simple AABB collision test between two rectangles (in px)
function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// check if a furniture obj (using new candidate px pos) would overlap any other furniture
function furnitureWouldCollide(obj, candidateX, candidateY) {
  if (obj.type !== 'furniture') return false;
  const aw = obj.width * SCALE, ah = obj.height * SCALE;
  for (const other of objects) {
    if (other === obj || other.type !== 'furniture') continue;
    const bw = other.width * SCALE, bh = other.height * SCALE;
    if (rectsOverlap(candidateX, candidateY, aw, ah, other.x, other.y, bw, bh)) return true;
  }
  return false;
}

// ------------------------- UI / Room -------------------------
function updateRoom() {
  const w = parseInt(document.getElementById("roomWidth").value);
  const h = parseInt(document.getElementById("roomLength").value);
  if (!isNaN(w) && w > 0) roomWidth = w;
  if (!isNaN(h) && h > 0) roomLength = h;
  drawGrid();
}

function setDefaults() {
  // only apply defaults when adding a NEW object (no selection)
  if (selectedObject) return; // don't override fields while editing
  const type = document.getElementById("objectType").value;
  const d = getDefaults(type);
  document.getElementById("objectWidth").value = d.width;
  document.getElementById("objectHeight").value = d.height;
}

// ------------------------- ADD / UPDATE -------------------------
function addObject() {
  const type = document.getElementById("objectType").value;
  const rawName = document.getElementById("objectName").value.trim();

    let name;
    if (rawName) {
        name = rawName;
    } else {
        typeCounters[type] = (typeCounters[type] || 0) + 1;
        name = `${type.charAt(0).toUpperCase() + type.slice(1)} ${typeCounters[type]}`;
    }
  
  let width = parseInt(document.getElementById("objectWidth").value);
  let height = parseInt(document.getElementById("objectHeight").value);
  if (isNaN(width) || isNaN(height)) {
    const d = getDefaults(type);
    width = d.width; height = d.height;
  }

  // default placement: furniture center-ish; wall items snap to left wall middle
  const roomPixelW = roomWidth * SCALE;
  const roomPixelH = roomLength * SCALE;
  let x = Math.floor(roomPixelW/6);
  let y = Math.floor(roomPixelH/6);

  if (type !== 'furniture') {
    x = 0;
    y = clamp(Math.floor(roomPixelH/2 - (height*SCALE)/2), 0, roomPixelH - height*SCALE);
  }

  const obj = { type, name, width, height, x, y };
  // if furniture would collide at default spot, try to nudge
  if (obj.type === 'furniture') {
    let tries = 0;
    while (furnitureWouldCollide(obj, obj.x, obj.y) && tries < 20) {
      obj.x += SCALE; // shift right
      if (obj.x + obj.width*SCALE > roomPixelW) {
        obj.x = 0;
        obj.y += SCALE; // shift down
      }
      tries++;
    }
    // if still colliding, just add anyway (rare)
  }

  if (type === "door") {
    obj.shape = "quadrant"; 
    obj.orientation = 0; // 0=top-left, 1=top-right, 2=bottom-right, 3=bottom-left
  } else {
    obj.shape = "rect";
  }

  objects.push(obj);
  drawGrid();
}

// Update the currently selected object's properties from the inputs
function updateObject() {
  if (!selectedObject) return alert("No object selected. Click an object on the canvas first.");
  const newType = document.getElementById("objectType").value;
  const newNameRaw = document.getElementById("objectName").value.trim();
  const newName = newNameRaw || selectedObject.type;
  const newW = parseInt(document.getElementById("objectWidth").value);
  const newH = parseInt(document.getElementById("objectHeight").value);

  // apply
  selectedObject.name = newName;
  if (!isNaN(newW)) selectedObject.width = newW;
  if (!isNaN(newH)) selectedObject.height = newH;

  // if type changed, set it and snap if wall-type
  if (newType !== selectedObject.type) {
    selectedObject.type = newType;

    if (newType !== 'furniture') {
      // snap to nearest wall and ensure inside limits
      snapObjectToNearestWall(selectedObject);
    } else {
      // for furniture, ensure it stays inside bounds and not overlapping
      ensureFurnitureInBounds(selectedObject);
    }
  } else {
    // same type: ensure constraints
    if (selectedObject.type === 'furniture') ensureFurnitureInBounds(selectedObject);
    else snapObjectToNearestWall(selectedObject);
  }

  drawGrid();
}

// ------------------------- DRAGGING & SNAPPING -------------------------
function snapObjectToNearestWall(obj) {
  const roomPixelW = roomWidth * SCALE;
  const roomPixelH = roomLength * SCALE;
  const objWpx = obj.width * SCALE;
  const objHpx = obj.height * SCALE;

  // find distances
  let candidateX = obj.x;
  let candidateY = obj.y;
  const distLeft = Math.abs(obj.x - 0);
  const distRight = Math.abs((roomPixelW - (obj.x + objWpx)));
  const distTop = Math.abs(obj.y - 0);
  const distBottom = Math.abs((roomPixelH - (obj.y + objHpx)));
  const minDist = Math.min(distLeft, distRight, distTop, distBottom);

  if (minDist === distLeft) {
    candidateX = 0;
    candidateY = clamp(obj.y, 0, roomPixelH - objHpx);
  } else if (minDist === distRight) {
    candidateX = roomPixelW - objWpx;
    candidateY = clamp(obj.y, 0, roomPixelH - objHpx);
  } else if (minDist === distTop) {
    candidateY = 0;
    candidateX = clamp(obj.x, 0, roomPixelW - objWpx);
  } else {
    candidateY = roomPixelH - objHpx;
    candidateX = clamp(obj.x, 0, roomPixelW - objWpx);
  }

  obj.x = candidateX;
  obj.y = candidateY;

}

// Keep furniture inside room and avoid overlapping other furniture (if possible)
function ensureFurnitureInBounds(obj) {
  const roomPixelW = roomWidth * SCALE;
  const roomPixelH = roomLength * SCALE;
  const wpx = obj.width * SCALE;
  const hpx = obj.height * SCALE;
  obj.x = clamp(obj.x, 0, roomPixelW - wpx);
  obj.y = clamp(obj.y, 0, roomPixelH - hpx);

  // if colliding, try to nudge it away a bit (simple heuristic)
  let tries = 0;
  while (furnitureWouldCollide(obj, obj.x, obj.y) && tries < 50) {
    obj.x += SCALE;
    if (obj.x + wpx > roomPixelW) {
      obj.x = 0;
      obj.y += SCALE;
      if (obj.y + hpx > roomPixelH) { obj.y = 0; } // wrap
    }
    tries++;
  }
}

// ------------------------- MOUSE EVENTS -------------------------
canvas.addEventListener("mousedown", (ev) => {
  const mx = ev.offsetX, my = ev.offsetY;

  // find top-most object under cursor (iterate backwards)
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    const objW = obj.width * SCALE, objH = obj.height * SCALE;

    // window drawing may sometimes swap visuals; use stored box for hit test (simple and predictable)
    if (mx >= obj.x && mx <= obj.x + objW && my >= obj.y && my <= obj.y + objH) {
      // set persistent selection
      selectedObject = obj;

      // start dragging this object
      dragObject = obj;
      offsetX = mx - obj.x;
      offsetY = my - obj.y;

      // populate UI fields with this object's data
      document.getElementById("objectType").value = obj.type;
      document.getElementById("objectName").value = obj.name;
      document.getElementById("objectWidth").value = obj.width;
      document.getElementById("objectHeight").value = obj.height;

      drawGrid();
      return;
    }
  }

  // clicked empty space -> deselect (but do not clear dragObject)
  // keep selection if you want; here we deselect only if click empty
  selectedObject = null;
  document.getElementById("objectName").value = "";
  // don't auto-change width/height on deselect
  drawGrid();
});

canvas.addEventListener("mousemove", (ev) => {
  if (!dragObject) return;
  const mx = ev.offsetX, my = ev.offsetY;
  const roomPixelW = roomWidth * SCALE;
  const roomPixelH = roomLength * SCALE;

  let newX = mx - offsetX;
  let newY = my - offsetY;

  // furniture movement: clamp and avoid overlapping other furniture
  if (dragObject.type === 'furniture') {
    newX = clamp(newX, 0, roomPixelW - dragObject.width * SCALE);
    newY = clamp(newY, 0, roomPixelH - dragObject.height * SCALE);

    // only commit if no collision
    if (!furnitureWouldCollide(dragObject, newX, newY)) {
      dragObject.x = newX;
      dragObject.y = newY;
    }
  } else {
    // snap to nearest wall; keep within wall extents
    const distLeft = Math.abs(newX - 0);
    const distRight = Math.abs((roomPixelW - (newX + dragObject.width * SCALE)));
    const distTop = Math.abs(newY - 0);
    const distBottom = Math.abs((roomPixelH - (newY + dragObject.height * SCALE)));
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);

    if (minDist === distLeft) {
      dragObject.x = 0;
      dragObject.y = clamp(newY, 0, roomPixelH - dragObject.height * SCALE);
    } else if (minDist === distRight) {
      dragObject.x = roomPixelW - dragObject.width * SCALE;
      dragObject.y = clamp(newY, 0, roomPixelH - dragObject.height * SCALE);
    } else if (minDist === distTop) {
      dragObject.y = 0;
      dragObject.x = clamp(newX, 0, roomPixelW - dragObject.width * SCALE);
    } else {
      dragObject.y = roomPixelH - dragObject.height * SCALE;
      dragObject.x = clamp(newX, 0, roomPixelW - dragObject.width * SCALE);
    }

  }

  drawGrid();
});

canvas.addEventListener("mouseup", () => {
  // stop dragging only (keep selectedObject for editing)
  dragObject = null;
});

function rotate() {
  if (!selectedObject) {
    alert("No object selected. Click an object first.");
    return;
  }

  if (selectedObject.shape === "rect") {
    // rectangles: swap width/height
    const tmp = selectedObject.width;
    selectedObject.width = selectedObject.height;
    selectedObject.height = tmp;

    document.getElementById("objectWidth").value = selectedObject.width;
    document.getElementById("objectHeight").value = selectedObject.height;
  } 
  else if (selectedObject.shape === "quadrant") {
    // quadrants: cycle orientation
    selectedObject.orientation = (selectedObject.orientation + 1) % 4;
  }

  drawGrid();
}


// ------------------------- INIT -------------------------
setDefaults(); // populate initial defaults for dropdown
updateRoom();  // draw
