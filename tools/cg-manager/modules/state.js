// ============================================================
// Shared State & Constants
// ============================================================

const STORAGE_PREFIX = 'nightcap_cg_pipeline_';
const CHARLIST_KEY = 'nightcap_cg_charlist';
const LASTCHAR_KEY = 'nightcap_cg_mgr_lastchar';

// IndexedDB constants
const IDB_NAME = 'nightcap_cg_manager';
const IDB_STORE = 'frame_images';
const IDB_VERSION = 1;

// Undo constants
const UNDO_MAX = 30;

// Mutable shared state
let currentCharId = 'blaze';
let items = [];
let selectedId = null;
let filter = 'all';
let fileExistence = {};
let viewMode = 'list';

// Game code cache
let charDataCache = null;   // { charId → { name, nameEn, cgEvents[], costumeStates[] } }
let charSourceRaw = null;   // characters.ts の生ソースコード
let cardNameCache = {};     // cardId → 日本語名
let harassmentCardCache = []; // [{ id, name, requiredDrunkLevel, instantWin }]
let reverseHarassCards = [];

// File System Access API
let projectDirHandle = null;

// Game preview state
let gpState = null;

// Drag & drop state
let pendingDropImage = null;  // { dataUrl, fileName }
let pendingBatchImages = [];  // [{ dataUrl, fileName }]

// Undo stack
const undoStack = [];

// Missing CG format
let missingCGFormat = 'json';
