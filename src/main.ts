import { LensMainExtension, Catalog } from "@k8slens/extensions";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as yaml from "js-yaml";
import { PreferencesStore } from "./preferences-store";
import { action, observable, reaction } from "mobx";

type Project = {
  name: string;
  projectId: string;
}

type MasterAuth = {
  clusterCaCertificate: string;
}

type Cluster = {
  name: string;
  zone: string;
  endpoint: string;
  selfLink: string;
  masterAuth: MasterAuth;
}

type Kubeconfig = {
  "current-context": string;
}

export default class GkeMain extends LensMainExtension {
  syncTimer: NodeJS.Timeout;
  projects: Project[] = [];
  clusters = observable.array<Catalog.KubernetesCluster>([]);

  async onActivate(): Promise<void> {
    console.log("GKE: activated");
    const preferencesStore = PreferencesStore.createInstance();

    await preferencesStore.loadExtension(this);

    reaction(() => preferencesStore.gcloudPath, () => {
      this.projects = [];
    });
    this.addCatalogSource("gke-clusters", this.clusters);
    this.syncClusters();
  }

  async onDeactivate(): Promise<void> {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.clusters.clear();
  }

  @action async syncClusters(): Promise<void> {
    if (this.projects.length === 0) {
      this.projects = await this.getProjects();
    }
    console.log("GKE: syncing clusters");

    const updatedClusters: Catalog.KubernetesCluster[] = [];
    try {
      const projects = await this.getProjects();
      for (const project of projects) {
        const clusters = await this.getClusters(project.projectId);
        if (clusters.length > 0) {
          for (const cluster of clusters) {
            updatedClusters.push(await this.ensureCluster(project, cluster));
          }
        } else {
          const index = this.projects.indexOf(project);
          if (index > -1) {
            this.projects.splice(index, 1);
          }
        }
      }
      this.clusters.replace(updatedClusters);
    } catch(error) {
      console.error("GKE: failed to sync with GKE", error);
      this.clusters.clear();
    }

    this.syncTimer = global.setTimeout(async () => {
      await this.syncClusters();
    }, 1000 * 60 * 3);
  }

  private async ensureCluster(project: Project, gkeCluster: Cluster) {
    const clusterId = crypto.createHash("md5").update(gkeCluster.selfLink).digest("hex");

    const kubeConfigPath = path.join(await this.getExtensionFileFolder(), gkeCluster.endpoint);
    fs.closeSync(fs.openSync(kubeConfigPath, "w"));
    await this.gcloud(["container", "clusters", "get-credentials", gkeCluster.name, "--zone", gkeCluster.zone, "--project", project.projectId], {
      ...process.env,
      "KUBECONFIG": kubeConfigPath
    })

    const kubeconfig = yaml.safeLoad(fs.readFileSync(kubeConfigPath).toString()) as Kubeconfig;

    return new Catalog.KubernetesCluster({
      apiVersion: "entity.k8slens.dev/v1alpha1",
      kind: "KubernetesCluster",
      metadata: {
        uid: clusterId,
        name: gkeCluster.name,
        source: "gke-sync",
        labels: {
          "zone": gkeCluster.zone,
          "projectName": project.name,
          "projectId": project.projectId
        }
      },
      spec: {
        kubeconfigPath: kubeConfigPath,
        kubeconfigContext: kubeconfig["current-context"]
      },
      status: {
        phase: "disconnected"
      }
    });
  }

  private async getProjects() {
    const projects = await this.gcloud<Project>(["projects", "list"]);

    return projects;
  }

  private async getClusters(projectId: string) {
    return this.gcloud<Cluster>(["container", "clusters", "list", "--project", projectId]);
  }

  private async gcloud<T>(args: string[], env?: NodeJS.ProcessEnv): Promise<T[]> {
    const gcloudBin = PreferencesStore.getInstance().gcloudPath || "gcloud";
    return new Promise((resolve, reject) => {
      exec(`${gcloudBin} ${args.join(" ")} --format json`, {
        env: env ?? process.env
      }, (error, stdout) => {
        if (error) {
          return reject(error);
        }
        return resolve(JSON.parse(stdout));
      })
    });
  }
}
