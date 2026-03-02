// ==UserScript==
// @name          [Pokeclicker] Updated Auto Mine (2026)
// @namespace     Pokeclicker Scripts
// @author        Kyuujin
// @description   Automatically mines the Underground. Last update 1st March 2026
// @copyright     https://github.com/Ephenia
// @license       GPL-3.0 License
// @version       2.2.4

// @homepageURL   https://github.com/Ephenia/Pokeclicker-Scripts/
// @supportURL    https://github.com/Ephenia/Pokeclicker-Scripts/issues
// @downloadURL   https://raw.githubusercontent.com/Ephenia/Pokeclicker-Scripts/master/enhancedautomine.user.js
// @updateURL     https://raw.githubusercontent.com/Ephenia/Pokeclicker-Scripts/master/enhancedautomine.user.js

// @match         https://www.pokeclicker.com/
// @icon          https://www.google.com/s2/favicons?domain=pokeclicker.com
// @grant         unsafeWindow
// @run-at        document-idle
// ==/UserScript==

var mineState = loadSetting('autoMineState', false);
var autoMineTimer = null; // stock interval/callback

function toggleAutoMine() {
	mineState = !mineState;
	localStorage.setItem('autoMineState', JSON.stringify(mineState));
	const btn = document.getElementById('auto-mine-start');
	if (btn) btn.className = `col-12 col-md-2 btn btn-${mineState ? 'success' : 'danger'}`;
	if (btn) btn.textContent = `Auto Mine [${mineState ? 'ON' : 'OFF'}]`;

	if (mineState) {
		myAutoMine();
	} else {
		if (autoMineTimer) {
			clearTimeout(autoMineTimer);
			autoMineTimer = null;
			console.log('[AutoMine] stopped');
		}
	}
}

function resetMineTiles() {
	const mine = App.game?.underground?.mine;
	if (!mine?._grid) return;
    mine._timeUntilDiscovery(0)
	mine._grid.forEach((tile, index) => {
		tile._layerDepth(index % 2);
		tile._survey(0);
	});
	// console.log('[AutoMine] Tiles reset');
}

let hammerTargets; // one time defined
let mineReady = false;

function waitForMine(callback) {
	const checkInterval = setInterval(() => {
		const mine = App.game?.underground?.mine;
		if (mine) {
			clearInterval(checkInterval);

			if (!mineReady) {
				// only created first run
				hammerTargets = getHammerTargets(mine);
				mineReady = true;
			}

			callback(mine);
		}
	}, 200);
}

function getHammerTargets(mine) {
	const width = mine._mineProperties.width;
	const height = mine._mineProperties.height;
	const targets = [];

	for (let row = 1; row < height; row += 3) {
		for (let col = 1; col < width; col += 3) {
			targets.push(row * width + col);
		}
	}

	// Last row
	targets.push(49, 124, 199, 274);
	return targets;
}

function autoHammerMine(onFinish) {
	const tools = App.game.underground.tools;
	if (!hammerTargets || !hammerTargets.length) return;

	let i = 0;
	const interval = setInterval(() => {
        if (tools[1].canUseTool()) {
            tools[1]._durability(1) // at some point it gets infinite so no need to check, we could remove this if statement for better perf
        }
		if (i >= hammerTargets.length) {
			clearInterval(interval);
			onFinish?.();
			return;
		}

		tools.selectedToolType = 1;
		UndergroundController.clickModalMineSquare(hammerTargets[i]);
		i++;
	}, 80);
}


function myAutoMine() {
    if (!mineState) return; // check if ON

	waitForMine(() => {
		resetMineTiles();
		autoHammerMine(() => {
			setTimeout(myAutoMine, 40); // start again after finished
		});
	});
}


function initAutoMine() {
    const minerHTML = document.createElement("div");
    undergroundDisplay.querySelector('.card-header').outerHTML += `<button id= "auto-mine-start" class="btn btn-sm btn-${mineState ? 'success' : 'danger'}" style="position: absolute;left: 0px;top: 0px;width: 65px;height: 41px;font-size: 7pt;">
    Auto Mine [${mineState ? 'ON' : 'OFF'}]
    </button>`
    const mineBody = document.getElementById('mineBody');
	if (mineBody) mineBody.appendChild(minerHTML);

    document.getElementById('auto-mine-start').addEventListener('click', event => { toggleAutoMine(event); });

    if (mineState) myAutoMine();
}

function loadSetting(key, defaultVal) {
    var val;
    try {
        val = JSON.parse(localStorage.getItem(key));
        if (val == null || typeof val !== typeof defaultVal) {
            throw new Error;
        }
    } catch {
        val = defaultVal;
        localStorage.setItem(key, defaultVal);
    }
    return val;
}

function addGlobalStyle(css) {
    var head, style;
    head = document.getElementsByTagName('head')[0];
    if (!head) { return; }
    style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = css;
    head.appendChild(style);
}

function loadEpheniaScript(scriptName, initFunction, priorityFunction) {
    function reportScriptError(scriptName, error) {
        console.error(`Error while initializing '${scriptName}' userscript:\n${error}`);
        Notifier.notify({
            type: NotificationConstants.NotificationOption.warning,
            title: scriptName,
            message: `The '${scriptName}' userscript crashed while loading. Check for updates or disable the script, then restart the game.\n\nReport script issues to the script developer, not to the Pokéclicker team.`,
            timeout: GameConstants.DAY,
        });
    }
    const windowObject = !App.isUsingClient ? unsafeWindow : window;
    // Inject handlers if they don't exist yet
    if (windowObject.epheniaScriptInitializers === undefined) {
        windowObject.epheniaScriptInitializers = {};
        const oldInit = Preload.hideSplashScreen;
        var hasInitialized = false;

        // Initializes scripts once enough of the game has loaded
        Preload.hideSplashScreen = function (...args) {
            var result = oldInit.apply(this, args);
            if (App.game && !hasInitialized) {
                // Initialize all attached userscripts
                Object.entries(windowObject.epheniaScriptInitializers).forEach(([scriptName, initFunction]) => {
                    try {
                        initFunction();
                    } catch (e) {
                        reportScriptError(scriptName, e);
                    }
                });
                hasInitialized = true;
            }
            return result;
        }
    }

    // Prevent issues with duplicate script names
    if (windowObject.epheniaScriptInitializers[scriptName] !== undefined) {
        console.warn(`Duplicate '${scriptName}' userscripts found!`);
        Notifier.notify({
            type: NotificationConstants.NotificationOption.warning,
            title: scriptName,
            message: `Duplicate '${scriptName}' userscripts detected. This could cause unpredictable behavior and is not recommended.`,
            timeout: GameConstants.DAY,
        });
        let number = 2;
        while (windowObject.epheniaScriptInitializers[`${scriptName} ${number}`] !== undefined) {
            number++;
        }
        scriptName = `${scriptName} ${number}`;
    }
    // Add initializer for this particular script
    windowObject.epheniaScriptInitializers[scriptName] = initFunction;
    // Run any functions that need to execute before the game starts
    if (priorityFunction) {
        $(document).ready(() => {
            try {
                priorityFunction();
            } catch (e) {
                reportScriptError(scriptName, e);
                // Remove main initialization function
                windowObject.epheniaScriptInitializers[scriptName] = () => null;
            }
        });
    }
}

if (!App.isUsingClient || localStorage.getItem('enhancedautomine') === 'true') {
    loadEpheniaScript('enhancedautomine', initAutoMine);
}
