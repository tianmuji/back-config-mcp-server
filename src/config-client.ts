import http from "http";
import https from "https";
import { URL } from "url";

export interface OperateCredentials {
  sessionCookie: string;
  csrfToken: string;
  expiresAt: number;
}

export class ConfigClient {
  private baseUrl: string;
  private credentials: OperateCredentials | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  setCredentials(creds: OperateCredentials | null): void {
    this.credentials = creds;
  }

  isAuthenticated(): boolean {
    return !!(this.credentials && Date.now() < this.credentials.expiresAt);
  }

  private postOnce(path: string, params: Record<string, string>): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.credentials) {
        reject(new Error("Not authenticated. Please call 'back-config-auth' first."));
        return;
      }

      const url = new URL(this.baseUrl + path);
      const mod = url.protocol === "https:" ? https : http;
      const body = new URLSearchParams(params).toString();

      const options: http.RequestOptions = {
        method: "POST",
        timeout: 30000,
        headers: {
          "Cookie": this.credentials.sessionCookie,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": String(Buffer.byteLength(body)),
          "x-csrf-token": this.credentials.csrfToken,
          "x-requested-with": "XMLHttpRequest",
          "accept": "application/json, text/plain, */*",
          "origin": this.baseUrl,
          "referer": `${this.baseUrl}/camscanner/back_config`,
        },
      };

      const req = mod.request(url.toString(), options, (res) => {
        if (res.statusCode === 302) {
          res.resume();
          reject(new Error("Authentication expired (302 redirect). Please call 'back-config-auth' to re-login."));
          return;
        }

        let respBody = "";
        res.on("data", (chunk) => (respBody += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(respBody));
          } catch {
            reject(new Error(`Invalid JSON response from ${path}: ${respBody.substring(0, 300)}`));
          }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Request timeout: ${path}`));
      });

      req.write(body);
      req.end();
    });
  }

  async post(path: string, params: Record<string, string>, retries = 2): Promise<any> {
    for (let i = 0; i <= retries; i++) {
      try {
        return await this.postOnce(path, params);
      } catch (err: any) {
        if (i === retries || !err.message?.includes("timeout")) throw err;
        console.error(`[ConfigClient] Retry ${i + 1}/${retries} for ${path}: ${err.message}`);
      }
    }
    throw new Error(`Request failed after ${retries} retries: ${path}`);
  }

  async getConfigMessage(key: string, platform: string, configType: string = "normal"): Promise<any> {
    return this.post("/camscanner/config-manage/get-config-mes", {
      config_type: configType,
      key,
      platform,
    });
  }

  async setConfigMessage(obj: string, platform: string, op?: number, configType: string = "normal"): Promise<any> {
    const params: Record<string, string> = {
      obj,
      platform,
    };
    if (configType !== "normal") {
      params.config_type = configType;
    }
    if (op !== undefined) {
      params.op = String(op);
    }
    return this.post("/camscanner/config-manage/set-config-mes", params);
  }

  async getTestList(platform: string): Promise<any> {
    return this.post("/camscanner/config-manage/get-test-list", {
      abname: "all",
      op: "0",
      appid: "COM.CS.MAIN.01",
      platform,
      key: "",
      remark: "",
      type: "2",
      page_id: "1",
      page_size: "10000",
    });
  }

  async getHistoryList(key: string, platform: string, timeSpace: number[], pageNum: number): Promise<any> {
    const params: Record<string, string> = {
      key,
      platform,
      page_num: String(pageNum),
    };
    if (timeSpace.length > 0) {
      params["time_space[0]"] = String(timeSpace[0]);
      params["time_space[1]"] = String(timeSpace[1]);
    }
    return this.post("/camscanner/config-manage/get-history-list", params);
  }

  async setBackConfig(key: string, platform: string, id: string): Promise<any> {
    return this.post("/camscanner/config-manage/set-back-config", {
      key,
      platform,
      id,
    });
  }
}
