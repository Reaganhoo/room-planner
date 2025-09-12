const canvas = document.getElementById("gridCanvas");
const ctx = canvas.getContext("2d");

let roomWidth = 20;
let roomLength = 20;
const cellSize = 20; // 1 ft = 20px

let furnitures = []; // store furniture objects
let dragging = null;
let offsetX, offsetY;

function drawGrid() {
  canvas.width = roomWidth * cellSize;
  canvas.height = roomLength * cellSize;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // draw grid lines
  ctx.strokeStyle = "#ddd";
  for (let x = 0; x <= roomWidth; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cellSize, 0);
    ctx.lineTo(x * cellSize, roomLength * cellSize);
    ctx.stroke();
  }
  for (let y = 0; y <= roomLength; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellSize);
    ctx.lineTo(roomWidth * cellSize, y * cellSize);
    ctx.stroke();
  }

  // draw room border
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, roomWidth * cellSize, roomLength * cellSize);

  // draw furniture
  furnitures.forEach(f => {
    ctx.fillStyle = "rgba(0, 150, 255, 0.5)";
    ctx.fillRect(f.x, f.y, f.w, f.h);

    ctx.strokeStyle = "blue";
    ctx.lineWidth = 2;
    ctx.strokeRect(f.x, f.y, f.w, f.h);

    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.fillText(f.name, f.x + 5, f.y + 15);
  });
}

function updateRoom() {
  roomWidth = parseInt(document.getElementById("roomWidth").value);
  roomLength = parseInt(document.getElementById("roomLength").value);
  drawGrid();
}

function addFurniture() {
  const name = document.getElementById("furnitureName").value;
  const fw = parseInt(document.getElementById("furnitureWidth").value);
  const fl = parseInt(document.getElementById("furnitureLength").value);

  const furniture = {
    id: Date.now(),
    name: name,
    x: 10,
    y: 10,
    w: fw * cellSize,
    h: fl * cellSize,
    widthFt: fw,
    lengthFt: fl
  };

  furnitures.push(furniture);
  updateFurnitureList();
  drawGrid();
}

function updateFurnitureList() {
  const listDiv = document.getElementById("furnitureList");
  listDiv.innerHTML = "";

  furnitures.forEach(f => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "furniture-item";

    itemDiv.innerHTML = `
      <label>Name: <input type="text" value="${f.name}" 
        onchange="editFurniture(${f.id}, 'name', this.value)"></label>
      <label>Width (ft): <input type="number" value="${f.widthFt}" 
        onchange="editFurniture(${f.id}, 'width', this.value)"></label>
      <label>Length (ft): <input type="number" value="${f.lengthFt}" 
        onchange="editFurniture(${f.id}, 'length', this.value)"></label>
    `;

    listDiv.appendChild(itemDiv);
  });
}

function editFurniture(id, field, value) {
  const f = furnitures.find(f => f.id === id);
  if (!f) return;

  if (field === "name") {
    f.name = value;
  } else if (field === "width") {
    f.widthFt = parseInt(value);
    f.w = f.widthFt * cellSize;
  } else if (field === "length") {
    f.lengthFt = parseInt(value);
    f.h = f.lengthFt * cellSize;
  }

  // keep inside room after resizing
  f.x = Math.max(0, Math.min(f.x, canvas.width - f.w));
  f.y = Math.max(0, Math.min(f.y, canvas.height - f.h));

  // prevent overlap after resize
  if (checkCollision(f)) {
    alert("Resize caused collision! Please adjust.");
  }

  drawGrid();
}

// ---------- Collision Utilities ----------
function isColliding(a, b) {
  return !(
    a.x + a.w <= b.x ||
    a.x >= b.x + b.w ||
    a.y + a.h <= b.y ||
    a.y >= b.y + b.h
  );
}

function checkCollision(furniture) {
  return furnitures.some(f => f.id !== furniture.id && isColliding(furniture, f));
}

// ---------- Dragging logic ----------
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  furnitures.forEach(f => {
    if (mouseX > f.x && mouseX < f.x + f.w &&
        mouseY > f.y && mouseY < f.y + f.h) {
      dragging = f;
      offsetX = mouseX - f.x;
      offsetY = mouseY - f.y;
    }
  });
});

canvas.addEventListener("mousemove", (e) => {
  if (dragging) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // proposed new position
    let newX = mouseX - offsetX;
    let newY = mouseY - offsetY;

    // clamp to keep inside the room
    newX = Math.max(0, Math.min(newX, canvas.width - dragging.w));
    newY = Math.max(0, Math.min(newY, canvas.height - dragging.h));

    // temporary move
    const oldX = dragging.x;
    const oldY = dragging.y;
    dragging.x = newX;
    dragging.y = newY;

    // if collides with others, revert
    if (checkCollision(dragging)) {
      dragging.x = oldX;
      dragging.y = oldY;
    }

    drawGrid();
  }
});

canvas.addEventListener("mouseup", () => {
  dragging = null;
});

drawGrid();
