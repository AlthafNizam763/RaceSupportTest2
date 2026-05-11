const COLLECTION_EVENT_NAME = "race:collection-mutated";
const AUTH_EVENT_NAME = "race:auth-changed";

const COLLECTION_ALIASES: Record<string, string> = {
  team_members: "team",
};

export function normalizeCollectionName(collection: string) {
  return COLLECTION_ALIASES[collection] ?? collection;
}

export function emitCollectionMutation(collection: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(COLLECTION_EVENT_NAME, {
      detail: { collection: normalizeCollectionName(collection) },
    })
  );
}

export function onCollectionMutation(listener: (collection: string) => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ collection?: string }>).detail;
    listener(normalizeCollectionName(detail?.collection ?? ""));
  };

  window.addEventListener(COLLECTION_EVENT_NAME, handler);
  return () => window.removeEventListener(COLLECTION_EVENT_NAME, handler);
}

export function emitAuthChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTH_EVENT_NAME));
}

export function onAuthChange(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(AUTH_EVENT_NAME, listener);
  return () => window.removeEventListener(AUTH_EVENT_NAME, listener);
}
