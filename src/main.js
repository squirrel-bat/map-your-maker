class Tile {
  constructor(x, y, rotation, type, trapsOn, secondPhase) {
    this.x = parseInt(x)
    this.y = parseInt(y)
    this.rotation = rotation ? parseInt(rotation) : undefined
    this.type = type
    this.trapsOn = trapsOn
    this.secondPhase = secondPhase
  }
}
const BUTTONS = {
  LMB: 1,
  RMB: 2,
}
const KEYS = {
  EDIT: 'e',
  SECOND: 's',
  ROTATE: 'r',
  MOVE: 't',
  COPY: 'c',
  DELETE: 'd',
  GENMAT: 'g',
  IMPORT: 'i',
  EXPORT: 'o',
  PURGE: 'p',
  UNDO: 'z',
  REDO: 'y',
  HELP: 'h',
  CONFIRM: 'f',
  ZOOM_RESET: '0',
}
const STATE = {
  activeBlock: null,
  hoveredTile: null,
  heldKey: null,
  _historyAtStep: 1,
  set historyAtStep(val) {
    this._historyAtStep = val
    updateHistoryButtons(val)
  },
  get historyAtStep() {
    return this._historyAtStep
  },
}
const MAX_HISTORY_LENGTH = 50
const TRAP_VARIANTS = {
  quad: ['1', '12', '13', '123', '1234'],
  triangle: ['a', 'b', 'c', 'ab', 'ac', 'bc', 'abc'],
}
const GRID_SIZE = { x: 25, y: 25 }
function rotateBy(prevRot, angle) {
  const newRot = (parseInt(prevRot) + angle) % 360
  if (360 - newRot > 360) return 360 + newRot
  return newRot
}

function createSlot(x, y) {
  const slot = document.createElement('div')
  slot.id = `slot-${x}-${y}`
  slot.classList.add('slot')

  slot.addEventListener('dragstart', (e) => {
    e.stopPropagation()
    e.preventDefault()
  })
  slot.addEventListener('dragenter', (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (e.dataTransfer.types.includes('application/json')) {
      // Fix for FF firing dragenter twice
      document
        .querySelectorAll('.drag-target')
        .forEach((el) => el.classList.remove('drag-target'))
      slot.classList.add('drag-target')
    }
  })

  slot.addEventListener('dragover', (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (e.dataTransfer.types.includes('application/json')) {
      e.dataTransfer.dropEffect = 'move'
    }
  })

  slot.addEventListener('dragleave', (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (e.dataTransfer.types.includes('application/json')) {
      slot.classList.remove('drag-target')
    }
  })
  slot.addEventListener('drop', (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (e.dataTransfer.types.includes('application/json')) {
      const dropData = JSON.parse(e.dataTransfer.getData('application/json'))
      if (slot.children.length > 0) {
        const targetTile = slot.children[0]
        targetTile.id = dropData.slotId.replace('slot', 'tile')
        document.getElementById(dropData.slotId).append(targetTile)
      }
      const pickedTile = document.getElementById(dropData.tileId)
      pickedTile.id = slot.id.replace('slot', 'tile')
      slot.append(pickedTile)
      slot.classList.remove('drag-target')
      checkBlossoms()
      save()
    }
  })
  slot.addEventListener('mousemove', (e) => {
    if (e.buttons == BUTTONS.LMB) {
      e.target.dispatchEvent(new MouseEvent('mouseup'), { cancelable: true })
    }
  })
  slot.addEventListener('mouseup', (e) => {
    if (
      STATE.activeBlock == null ||
      slot.children.length > 0 ||
      e.button !== 0
    ) {
      return
    }
    switch (STATE.heldKey) {
      case KEYS.GENMAT:
        const genmat = document.getElementById(
          document.querySelector('.tile:has(.genmat)')?.id,
        )
        if (genmat) {
          genmat.id = `tile-${x}-${y}`
          slot.append(genmat)
        } else {
          slot.append(createTile(new Tile(x, y, undefined, 'genmat')))
        }
        save()
        break
      case null:
        if (
          STATE.activeBlock.type.contains('blossom-mine') &&
          !slot.classList.contains('mine-slot')
        ) {
          break
        }
        slot.append(
          createTile(
            new Tile(x, y, STATE.activeBlock.rotation, STATE.activeBlock.type),
          ),
        )
        checkBlossoms()
        save()
        break
    }
  })
  return slot
}

function createTile(data) {
  const tile = document.createElement('div')
  tile.id = `tile-${data.x}-${data.y}`
  tile.classList.add('tile')
  tile.setAttribute('draggable', true)

  const block = document.createElement('div')
  const classes =
    typeof data.type == 'string' ? data.type.split(' ') : data.type
  block.classList.add(...classes)
  if (data.rotation) block.dataset.rotation = data.rotation
  if (data.trapsOn) block.dataset.trapsOn = data.trapsOn
  if (data.secondPhase) block.dataset.secondPhase = data.secondPhase
  tile.append(block)

  tile.addEventListener('dragstart', (e) => {
    if (STATE.heldKey != KEYS.MOVE) return
    e.stopPropagation()
    e.dataTransfer.clearData()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify(
        {
          tileId: tile.id,
          slotId: tile.parentNode.id,
        },
        null,
        2,
      ),
    )
    tile.classList.add('dragging')
  })
  tile.addEventListener('dragend', (e) => {
    e.stopPropagation()
    tile.classList.remove('dragging')
  })
  tile.addEventListener('mouseenter', (e) => {
    STATE.hoveredTile = tile
    if (e.buttons == BUTTONS.LMB) {
      e.target.dispatchEvent(new MouseEvent('mousedown'), { cancelable: true })
    }
  })
  tile.addEventListener('mousemove', () => {
    tile.classList.toggle('cursor-edit', STATE.heldKey == KEYS.EDIT)
    tile.classList.toggle('cursor-second', STATE.heldKey == KEYS.SECOND)
    tile.classList.toggle('cursor-rotate', STATE.heldKey == KEYS.ROTATE)
    tile.classList.toggle('cursor-transport', STATE.heldKey == KEYS.MOVE)
    tile.classList.toggle('cursor-copy', STATE.heldKey == KEYS.COPY)
    tile.classList.toggle('cursor-delete', STATE.heldKey == KEYS.DELETE)
    tile.setAttribute('draggable', STATE.heldKey == KEYS.MOVE)
  })
  tile.addEventListener('mouseleave', () => {
    tile.classList.remove(
      'cursor-edit',
      'cursor-second',
      'cursor-rotate',
      'cursor-transport',
      'cursor-copy',
      'cursor-delete',
    )
    tile.setAttribute('draggable', true)
    STATE.hoveredTile = null
  })
  tile.addEventListener('mousedown', (e) => {
    e.stopPropagation()
    const block = tile.querySelector('.block')
    switch (STATE.heldKey) {
      case KEYS.DELETE:
        const delTileAnim = tile.animate([{ scale: 1.5, opacity: 0 }], {
          duration: 150,
          easing: 'ease-out',
        })
        delTileAnim.addEventListener('finish', () => {
          tile.remove()
          checkBlossoms()
          save()
        })
        break
      case KEYS.COPY:
        const tool = document.querySelector(
          '#toolbar .' + [...tile.firstChild.classList].join('.'),
        )
        if (tool == null) return
        tool.dataset.rotation = tile.firstChild.dataset.rotation
        tool.dispatchEvent(new MouseEvent('click'), { cancelable: true })
        break
      case KEYS.ROTATE:
        if (block == null) return
        const selectedTool = document.getElementById('selected-tool')
        const newRot = rotateBy(
          block.dataset.rotation || 0,
          e.shiftKey ? -90 : 90,
        )
        block.dataset.rotation = newRot
        if (block.classList.value == selectedTool.classList.value) {
          STATE.activeBlock.rotation = newRot
          selectedTool.dataset.rotation = newRot
        }
        save()
        break
      case KEYS.SECOND:
        const child = tile.firstChild
        if (
          child.classList.contains('trap') ||
          child.dataset.trapsOn != undefined
        ) {
          if (child.dataset.secondPhase == undefined) {
            child.dataset.secondPhase = true
          } else {
            delete child.dataset.secondPhase
          }
          save()
        }
        break
      case KEYS.EDIT:
        if (block == null) return
        const blockType = block.classList.contains('block-full')
          ? 'quad'
          : 'triangle'
        if (block.dataset.trapsOn == undefined) {
          block.dataset.trapsOn = TRAP_VARIANTS[blockType][0]
        } else {
          const newValue =
            TRAP_VARIANTS[blockType][
              TRAP_VARIANTS[blockType].indexOf(block.dataset.trapsOn) + 1
            ]
          if (newValue == undefined) {
            delete block.dataset.trapsOn
            delete block.dataset.secondPhase
          } else {
            block.dataset.trapsOn = newValue
          }
        }
        save()
        break
    }
  })
  return tile
}

function renderGrid() {
  const grid = document.getElementById('grid')
  for (let y = 1; y <= GRID_SIZE.y; y++) {
    for (let x = 1; x <= GRID_SIZE.x; x++) {
      grid.append(createSlot(x, y))
    }
  }
}
function resetGrid() {
  document.querySelectorAll('.slot').forEach((slot) => (slot.innerHTML = ''))
}
function renderTiles(tiles) {
  tiles.forEach((tileData) => {
    document
      .getElementById(`slot-${tileData.x}-${tileData.y}`)
      .append(createTile(tileData))
  })
}

function setupTools() {
  document
    .querySelectorAll('.tool-grp div:not([data-tool-grp])')
    .forEach((tool) => {
      tool.addEventListener('click', () => {
        STATE.activeBlock = new Tile(
          -1,
          -1,
          tool.dataset.rotation,
          tool.classList,
        )
        document.getElementById('selected-tool').removeAttribute('id')
        tool.id = 'selected-tool'
        checkBlossoms()
      })
      tool.dataset.rotation = 0
    })
  document
    .getElementById('selected-tool')
    .dispatchEvent(new MouseEvent('click'), { cancelable: true })
}

function checkBlossoms() {
  document
    .getElementById('grid')
    .classList.toggle(
      'blossom-check',
      STATE.activeBlock.type.contains('blossom') ||
        STATE.activeBlock.type.contains('blossom-mine'),
    )
  document.querySelectorAll('#grid .mine-slot').forEach((el) => {
    el.classList.remove('mine-slot')
  })
  document.querySelectorAll('.tile:has(.blossom)').forEach((el) => {
    const [_, x, y] = el.id.split('-').map(Number)
    const ids = [
      `slot-${x - 1}-${y}`,
      `slot-${x - 2}-${y}`,
      `slot-${x + 1}-${y}`,
      `slot-${x + 2}-${y}`,
      `slot-${x}-${y - 1}`,
      `slot-${x}-${y - 2}`,
      `slot-${x}-${y + 1}`,
      `slot-${x}-${y + 2}`,
    ]
    for (const [i, id] of ids.entries()) {
      const slot = document.getElementById(id)
      if (!slot) continue
      if (
        i % 2 == 1 &&
        document.getElementById(ids[i - 1]).children.length > 0
      ) {
        continue
      }
      if (slot.querySelector('.blossom-mine')) {
        slot.classList.add('valid-mine')
      }
      slot.classList.toggle('mine-slot', slot.children.length == 0)
    }
  })
  document.querySelectorAll('.slot:has( .blossom-mine)').forEach((el) => {
    if (el.classList.contains('valid-mine')) {
      el.classList.remove('valid-mine')
      return
    }
    el.children[0].remove()
  })
}

function zoom(sign, reset = false) {
  const newVal = reset
    ? 1
    : parseFloat(document.getElementById('grid').style.zoom || 1) + 0.1 * sign
  if (newVal > 4 || newVal < 0.1) return
  document.getElementById('grid').style.zoom = newVal
  document.getElementById('zoom-val').innerHTML = Math.round(newVal * 100) + '%'
}

function setupButtons() {
  document.getElementById('history-undo').addEventListener('click', undo)
  document.getElementById('history-redo').addEventListener('click', redo)

  document.getElementById('zoom-out').addEventListener('click', () => zoom(-1))
  document
    .getElementById('zoom-val')
    .addEventListener('click', () => zoom(null, true))
  document.getElementById('zoom-in').addEventListener('click', () => zoom(1))

  document
    .getElementById('help-btn')
    .addEventListener('click', () => openJustOneModal('help'))

  const helpNavButtons = document.querySelectorAll('#help-body nav button')
  helpNavButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      helpNavButtons.forEach((btn) => {
        btn.classList.remove('active')
      })
      document.querySelectorAll('.help-page').forEach((page) => {
        page.hidden = true
      })
      document.getElementById('page-' + btn.dataset.page).hidden = false
      btn.classList.add('active')
    })
  })

  document.querySelectorAll('[data-link]').forEach((el) => {
    el.addEventListener('click', () => {
      const [link, anchor] = el.dataset.link.split('#')
      document.querySelector(`button[data-page="${link}"]`).click()
      if (anchor) {
        setTimeout(
          () =>
            document
              .querySelector(`.help-page:not([hidden]) #${anchor}`)
              .scrollIntoView({ behavior: 'smooth' }),
          100,
        )
      }
    })
  })
}

window.addEventListener('load', () => {
  const design = loadDesign()
  sessionStorage.removeItem('history')
  pushHistory(design)
  renderGrid()
  renderTiles(design)
  setupTools()
  setupButtons()

  window.addEventListener('keydown', (e) => {
    if (
      e.key == STATE.heldKey ||
      e.repeat ||
      e.ctrlKey ||
      e.altKey ||
      e.shiftKey
    )
      return
    if (!document.getElementById('welcome').hidden) {
      document.getElementById('welcome').hidden = true
      document.getElementById('main').hidden = false
      return
    }
    if (Object.values(KEYS).includes(e.key)) {
      switch (e.key) {
        case KEYS.IMPORT:
          openJustOneModal('import')
          break
        case KEYS.EXPORT:
          openJustOneModal('export')
          break
        case KEYS.PURGE:
          openJustOneModal('purge')
          break
        case KEYS.HELP:
          openJustOneModal('help')
          break
        case KEYS.UNDO:
          document.getElementById('history-undo').click()
          break
        case KEYS.REDO:
          document.getElementById('history-redo').click()
          break
        case KEYS.ZOOM_RESET:
          document.getElementById('zoom-val').click()
          break
        case KEYS.CONFIRM:
          document.querySelector('dialog[open] .confirm')?.click()
          break
      }
      STATE.heldKey = e.key.toLowerCase()
      document.body.classList.toggle('cur-move', STATE.heldKey == KEYS.MOVE)
      document.body.classList.toggle('cur-genmat', STATE.heldKey == KEYS.GENMAT)
      if (STATE.hoveredTile) {
        STATE.hoveredTile.dispatchEvent(new MouseEvent('mousemove'), {
          cancelable: true,
        })
      }
    }
    if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
      for (const tool of document.querySelector(`[data-tool-grp="${e.key}"]`)
        .children) {
        if (tool.hasAttribute('id') == false) {
          tool.click()
          break
        }
      }
    }
  })
  window.addEventListener('keyup', () => {
    STATE.heldKey = null
    document.body.classList.remove('cur-move', 'cur-genmat')
    if (STATE.hoveredTile) {
      STATE.hoveredTile.dispatchEvent(new MouseEvent('mousemove'), {
        cancelable: true,
      })
    }
  })
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) {
        e.preventDefault()
        e.stopPropagation()
        zoom(Math.sign(e.wheelDeltaY))
      }
    },
    { passive: false },
  )

  document.getElementById('import').addEventListener('submit', (e) => {
    if (e.submitter.value == 'confirm') {
      const files = document.getElementById('import-file')?.files
      if (files.length > 0) importMapData(files)
    }
  })
  document.getElementById('export').addEventListener('submit', (e) => {
    if (e.submitter.value == 'confirm')
      exportMapData(document.getElementById('filename')?.value || undefined)
  })
  document.getElementById('purge').addEventListener('submit', (e) => {
    if (e.submitter.value == 'confirm') {
      resetGrid()
      save()
    }
  })
})
function openJustOneModal(id) {
  document.querySelector(`dialog[open]:not(#${id})`)?.close()
  document.getElementById(id)?.showModal()
}

function save() {
  const data = []
  document.querySelectorAll('.tile').forEach((tile) => {
    const [_, x, y] = tile.id.split('-').map(Number)
    const tileChild = tile.querySelector('div')
    data.push(
      new Tile(
        x,
        y,
        tileChild.dataset.rotation,
        tileChild.classList.value,
        tileChild.dataset.trapsOn || undefined,
        tileChild.dataset.secondPhase ? true : undefined,
      ),
    )
  })
  saveDesign(data)
  pushHistory(data)
}

function saveDesign(data) {
  if (data.length == 0) {
    localStorage.removeItem('currentDesign')
  } else {
    localStorage.setItem('currentDesign', JSON.stringify(data, null, 2))
  }
}

function loadDesign() {
  return JSON.parse(localStorage.getItem('currentDesign')) || []
}

function pushHistory(data) {
  const history = JSON.parse(sessionStorage.getItem('history')) || []
  if (STATE.historyAtStep < history.length) {
    history.length = STATE.historyAtStep
  }
  if (history.length > MAX_HISTORY_LENGTH) history.shift()
  const newStep = history.push(data)
  sessionStorage.setItem('history', JSON.stringify(history, null, 2))
  STATE.historyAtStep = newStep
}

function readHistoryAt(newPos = 0) {
  const history = JSON.parse(sessionStorage.getItem('history')) || []
  if (
    history.length == 0 ||
    STATE.historyAtStep + newPos < 1 ||
    STATE.historyAtStep + newPos > history.length
  ) {
    return
  }
  STATE.historyAtStep += newPos
  return history.at(STATE.historyAtStep - 1)
}

function undo() {
  const newState = readHistoryAt(-1)
  if (newState) {
    resetGrid()
    renderTiles(newState)
    checkBlossoms()
    saveDesign(newState)
  }
}

function redo() {
  const newState = readHistoryAt(1)
  if (newState) {
    resetGrid()
    renderTiles(newState)
    checkBlossoms()
    saveDesign(newState)
  }
}

function updateHistoryButtons(step) {
  const history = JSON.parse(sessionStorage.getItem('history')) || []
  document.getElementById('history-undo').disabled = step <= 1
  document.getElementById('history-redo').disabled = step >= history.length
}

const FILENAMES = [
  'I_should_pick_a_better_name_for_this_map',
  'no0ne_named_this_map',
  'Naming_maps_is_hard',
  'my_map_v3_final_FINAL(3)',
  'I_told_you_I_would_name_this_map_for_you',
  'Are_you_sure_it_saved_the_whole_map',
  'INTERNAL_MAP_ERROR_just_kidding',
  'This_better_not_be_another_maze_map',
  'MYM_map_and_private_browser_history',
  'MYM_map_and_private_ssh_key',
  'xXx_3L1T3H_SH4D0W_R34V3R_M4P_xXx',
  'Did_you_know_squirrelbat_has_a_Ko-fi',
  'Never_trust_a_map_you_download_from_the_internet',
  'You_wouldnt_download_a_map',
  'Meet_Your_Mapper',
  'MyHouse.wad',
  'Please_fix_napalm',
  'Please_note_that_Map_Your_Maker_is_not_free_software._After_a_40_day_trial_period_you_must_either_buy_a_license_or_remove_it_from_your_browsing_history',
  'Are_you_still_mapping',
  'Rock_Rapids_by_Copperbadge',
  'Haven_by_Copperbadge',
  'Skamokawa_Valley_by_Copperbadge',
  'Robstown_by_Copperbadge',
  'Wolbach_by_Copperbadge',
  'Vanceburg_by_Copperbadge',
  'Copper_Hill_by_Copperbadge',
  'Sandwich_by_Copperbadge',
  'We_have_been_trying_to_reach_you_about_your_maps_extended_warranty',
  'Eminem_is_my_favourite_mapper',
  'Pantheon_of_Builders_material',
  'homework',
  'Paul_Allens_map',
]

function exportMapData(filename) {
  filename = filename || FILENAMES[Math.floor(Math.random() * FILENAMES.length)]
  const data = new Blob(
    [
      JSON.stringify(
        {
          name: filename,
          created: new Date().toJSON(),
          data: loadDesign(),
        },
        null,
        2,
      ),
    ],
    {
      type: 'application/json',
    },
  )
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename + '.json'
  a.click()
  URL.revokeObjectURL(url)
}

async function importMapData(files) {
  const blob = new Blob([files.item(0)], { type: 'application/json' })
  if (blob.type == 'application/json') {
    const map = JSON.parse(await blob.text())
    resetGrid()
    renderTiles(map.data)
    save()
  }
}
