import { LensRendererExtension, Component } from "@k8slens/extensions";
import React from "react";
import { preferencesStore } from "./preferences-store";
import { PreferenceHint, PreferenceInput } from "./preferences"

export default class GkeRenderer extends LensRendererExtension {
  statusBarItems = [
    {
      item: (
        <a title="Open Google Cloud Console" href="https://console.cloud.google.com/kubernetes/list" target="_blank" className="flex align-center gaps hover-highlight" style={ {"textDecoration": "none"} }>
          <Component.Icon material="cloud_queue" /> <span className="flex gaps">GKE</span>
        </a>
      )
    }
  ]

  appPreferences = [
    {
      title: "Google Kubernetes Engine",
      components: {
        Hint: (): JSX.Element => <PreferenceHint/>,
        Input: (): JSX.Element => <PreferenceInput preferences={preferencesStore}/>
      }
    }
  ];

  async onActivate(): Promise<void> {
    await preferencesStore.loadExtension(this);
  }
}
