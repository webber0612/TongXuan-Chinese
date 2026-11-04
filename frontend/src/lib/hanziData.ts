import type { CharDataLoaderFn } from "hanzi-writer";

/** Character data is distributed with the app for same-origin and offline use. */
export const loadLocalHanziData: CharDataLoaderFn = (character, onLoad, onError) => {
  const url = `${import.meta.env.BASE_URL}hanzi/${encodeURIComponent(character)}.json`;
  void Promise.resolve().then(() => fetch(url))
    .then((response) => {
      if (!response.ok) throw new Error(`hanzi_data_${response.status}`);
      return response.json();
    })
    .then(onLoad)
    .catch(onError);
};
