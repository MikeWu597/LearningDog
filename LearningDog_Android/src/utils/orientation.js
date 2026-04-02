const ORIENTATION = {
  portrait: 'portrait',
  landscape: 'landscape',
};

async function getOrientationPlugin() {
  try {
    const mod = await import('@capacitor/screen-orientation');
    return mod.ScreenOrientation;
  } catch {
    return null;
  }
}

export async function lockAppOrientation(mode) {
  const target = mode === ORIENTATION.landscape ? ORIENTATION.landscape : ORIENTATION.portrait;

  const plugin = await getOrientationPlugin();
  if (plugin) {
    try {
      await plugin.lock({ orientation: target });
      return;
    } catch {
      // Fall back to browser orientation lock for dev mode.
    }
  }

  if (window?.screen?.orientation?.lock) {
    const browserTarget = target === ORIENTATION.landscape ? 'landscape-primary' : 'portrait-primary';
    try {
      await window.screen.orientation.lock(browserTarget);
    } catch {
      // iOS browser may reject lock requests.
    }
  }
}

export function getOrientationModeByPath(pathname) {
  return pathname.startsWith('/room/') ? ORIENTATION.landscape : ORIENTATION.portrait;
}
