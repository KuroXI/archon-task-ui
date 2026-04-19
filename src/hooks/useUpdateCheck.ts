import { useState, useEffect } from "react";
import { checkForUpdate } from "../data/updater.js";

export function useUpdateCheck(): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    checkForUpdate().then((available) => {
      if (available) setUpdateAvailable(true);
    });
  }, []);

  return updateAvailable;
}
