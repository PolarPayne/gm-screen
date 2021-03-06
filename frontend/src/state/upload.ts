import m from "mithril";
import Stream from "mithril/stream";

import * as space from "./space";
import { randomId } from "../utils";

type Upload = {
  id: string;
  loaded: number;
  total: number;
};

export const State = () => ({ uploads: Stream<Upload[]>([]) });
export type State = ReturnType<typeof State>;

export const Actions = (state: State & space.State) => {
  const createUpload = (upload: Upload) => {
    state.uploads([...state.uploads(), upload]);
  };

  const updateUpload = (upload: Upload) => {
    state.uploads(
      state.uploads().map((v) => (v.id === upload.id ? upload : v))
    );
  };

  const removeUpload = (id: string) => {
    state.uploads(state.uploads().filter((v) => v.id !== id));
  };

  const config = (id: string) => {
    const update = (event: ProgressEvent) => {
      updateUpload({ id, loaded: event.loaded, total: event.total });
      m.redraw();
    };

    const done = () => {
      console.log("[Upload] upload done");
      setTimeout(() => {
        removeUpload(id);
        m.redraw();
      }, 2000);
    };

    return (xhr: XMLHttpRequest) => {
      xhr.upload.addEventListener("progress", update);
      xhr.upload.addEventListener("load", done);

      return xhr;
    };
  };

  const upload = (files: File[]): Promise<unknown[]> => {
    const ps = files.map((file) => {
      const body = new FormData();
      body.append("files", file);

      const id = randomId();

      createUpload({ id, loaded: 0, total: file.size });
      m.redraw();

      console.log("[Upload] upload starting", file);
      return m.request({
        url: "/assets/",
        params: { space_id: state.space() },
        method: "POST",
        config: config(id),
        body,
      });
    });

    return Promise.all(ps).then((ps) => ps.flat());
  };

  return { upload };
};

export type Actions = ReturnType<typeof Actions>;