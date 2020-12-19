import { LensMainExtension, Store } from "@k8slens/extensions";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as yaml from "js-yaml";
import { preferencesStore } from "./preferences-store";
import { reaction } from "mobx";

const workspaceStore = Store.workspaceStore;
const clusterStore = Store.clusterStore;

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

const ownerRef = "gke-sync";

export default class GkeMain extends LensMainExtension {
  syncTimer: NodeJS.Timeout;
  projects: Project[] = [];

  async onActivate(): Promise<void> {
    console.log("GKE: activated");
    await preferencesStore.loadExtension(this);

    workspaceStore.workspacesList.filter((workspace) => workspace.ownerRef === ownerRef).forEach((workspace) => workspace.enabled = true);
    clusterStore.clustersList.filter((cluster) => cluster.ownerRef === ownerRef).forEach((cluster) => cluster.enabled = true);

    reaction(() => preferencesStore.gcloudPath, () => {
      this.projects = [];
    });
    this.syncClusters();
  }

  async onDeactivate(): Promise<void> {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    workspaceStore.workspacesList.filter((workspace) => workspace.ownerRef === ownerRef).forEach((workspace) => workspace.enabled = false);
    clusterStore.clustersList.filter((cluster) => cluster.ownerRef === ownerRef).forEach((cluster) => cluster.enabled = false);

    if (clusterStore.activeCluster && clusterStore.activeCluster.ownerRef === ownerRef) {
      clusterStore.activeClusterId = null;
    }
    if (workspaceStore.currentWorkspace.ownerRef === ownerRef) {
      workspaceStore.setActive(null);
    }
  }

  async syncClusters(): Promise<void> {
    if (this.projects.length === 0) {
      this.projects = await this.getProjects();
    }
    console.log("GKE: syncing clusters");
    try {
      const projects = await this.getProjects();
      for (const project of projects) {
        const clusters = await this.getClusters(project.projectId);
        if (clusters.length > 0) {
          const workspace = this.ensureWorkspace(project);
          for (const cluster of clusters) {
            await this.ensureCluster(workspace, cluster);
          }
        } else {
          const index = this.projects.indexOf(project);
          if (index > -1) {
            this.projects.splice(index, 1);
          }
        }
      }
    } catch(error) {
      console.error("GKE: failed to sync with GKE", error);
    } finally {
      try {
        await this.cleanup();
      } catch(error) {
        console.error("GKE: failed to do cleanup", error);
      }
    }

    this.syncTimer = global.setTimeout(async () => {
      await this.syncClusters();
    }, 1000 * 60 * 3);
  }

  private async cleanup() {
    const gkeWorkspaces = workspaceStore.workspacesList.filter((workspace) => workspace.ownerRef === ownerRef)
    const projects = this.projects;
    for (const workspace of gkeWorkspaces) {
      if (!projects.find((project) => project.projectId === workspace.id)) {
        workspaceStore.removeWorkspace(workspace);
      } else {
        const gkeClusters = clusterStore.clustersList.filter((cluster) => cluster.workspace === workspace.id);
        if (gkeClusters.length > 0) {
          const clusters = await this.getClusters(workspace.id);
          for(const cluster of gkeClusters) {
            if (!clusters.find((c) => c.name === cluster.name)) {
              clusterStore.removeCluster(cluster);
            }
          }
        }
      }
    }
  }

  private ensureWorkspace(project: Project) {
    let workspace = workspaceStore.workspacesList.find((workspace) => workspace.ownerRef === "gke" && workspace.id === project.projectId);
    if (!workspace) {
      workspace = new Store.Workspace({
        name: `GKE: ${project.name}`,
        ownerRef: ownerRef,
        id: project.projectId
      })
      workspaceStore.addWorkspace(workspace);
    }

    workspace.enabled = true;

    return workspace;
  }

  private async ensureCluster(workspace: Store.Workspace, gkeCluster: Cluster) {
    const clusterId = crypto.createHash("md5").update(gkeCluster.selfLink).digest("hex");
    let cluster = clusterStore.clustersList.find((c) => c.workspace === workspace.id && c.id === clusterId);
    const kubeConfigPath = path.join(await this.getExtensionFileFolder(), gkeCluster.endpoint);

    fs.closeSync(fs.openSync(kubeConfigPath, "w"));
    await this.gcloud(["container", "clusters", "get-credentials", gkeCluster.name, "--zone", gkeCluster.zone, "--project", workspace.id], {
      ...process.env,
      "KUBECONFIG": kubeConfigPath
    })

    if (!cluster) {
      const kubeconfig = yaml.safeLoad(fs.readFileSync(kubeConfigPath).toString()) as Kubeconfig;

      cluster = new Store.Cluster({
        id: clusterId,
        preferences: {
          clusterName: gkeCluster.name,
        },
        workspace: workspace.id,
        ownerRef: ownerRef,
        kubeConfigPath: kubeConfigPath,
        contextName: kubeconfig["current-context"]
      })
      clusterStore.addCluster(cluster);
    }
    cluster.enabled = true;

    return cluster;
  }

  private async getProjects() {
    const projects = await this.gcloud<Project>(["projects", "list"]);

    return projects;
  }

  private async getClusters(projectId: string) {
    return this.gcloud<Cluster>(["container", "clusters", "list", "--project", projectId]);
  }

  private async gcloud<T>(args: string[], env?: NodeJS.ProcessEnv): Promise<T[]> {
    const gcloudBin = preferencesStore.gcloudPath || "gcloud";
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
