import {
  HarvestClientsResponse,
  HarvestCompanyResponse,
  HarvestProjectAssignmentsResponse,
  HarvestTimeEntriesResponse,
  HarvestTimeEntryCreatedResponse,
  HarvestTimeEntryResponse,
  HarvestTimeEntry,
  HarvestCompany,
  HarvestClient,
  HarvestProjectAssignment,
} from "./responseTypes";
import { getPreferenceValues } from "@raycast/api";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { NewTimeEntryDuration, NewTimeEntryStartEnd } from "./requestTypes";
import dayjs from "dayjs";
import useSWR from "swr";

interface Preferences {
  token: string;
  accountID: string;
}

const { token, accountID }: Preferences = getPreferenceValues();
const api = axios.create({
  baseURL: "https://api.harvestapp.com/v2",
  headers: {
    Authorization: `Bearer ${token}`,
    "Harvest-Account-Id": accountID,
    "User-Agent": "Raycast Extension (https://github.com/eluce2)",
    "Content-Type": "application/json",
  },
});

async function harvestAPI<T = AxiosResponse>({ method = "GET", ...props }: AxiosRequestConfig) {
  const resp = await api.request<unknown, T>({ method, ...props });
  return resp;
}

export function useCompany() {
  const { data, error } = useSWR<HarvestCompany>("company", async () => {
    const resp = await harvestAPI<HarvestCompanyResponse>({ url: "/company" });
    return resp.data;
  });
  return { data, error, isLoading: !data && !error };
}

export function useActiveClients() {
  const { data, error } = useSWR<HarvestClient[]>("clients", async () => {
    const resp = await harvestAPI<HarvestClientsResponse>({ url: "/clients", params: { is_active: true } });
    return resp.data.clients;
  });
  return { data, error, isLoading: !data && !error };
}

export function useMyProjects() {
  const { data, error } = useSWR<HarvestProjectAssignment[]>("project-assignments", async () => {
    const resp = await harvestAPI<HarvestProjectAssignmentsResponse>({ url: "/users/me/project_assignments" });
    return resp.data.project_assignments;
  });
  return { data, error, isLoading: !data && !error };
}

export async function getMyTimeEntries({ from = new Date(), to = new Date() }: { from: Date; to: Date }) {
  let time_entries: HarvestTimeEntry[] = [];
  let page = 1;
  while (true) {
    const resp = await harvestAPI<HarvestTimeEntriesResponse>({
      url: "/time_entries",
      params: {
        from: dayjs(from).startOf("day").format(),
        to: dayjs(to).endOf("day").format(),
        page,
      },
    });
    time_entries = time_entries.concat(resp.data.time_entries);
    if (resp.data.total_pages >= resp.data.page) break;
    page += 1;
  }
  return time_entries;
}

export async function newTimeEntry(param: NewTimeEntryDuration | NewTimeEntryStartEnd) {
  const resp = await harvestAPI<HarvestTimeEntryCreatedResponse>({ method: "POST", url: "/time_entries", data: param });
  return resp.data;
}

export async function stopTimer(entry?: HarvestTimeEntry) {
  if (!entry) {
    const resp = await harvestAPI<HarvestTimeEntriesResponse>({ url: "/time_entries", params: { is_running: true } });
    if (resp.data.time_entries.length === 0) {
      return true;
    }
    entry = resp.data.time_entries[0];
  }
  await harvestAPI<HarvestTimeEntryResponse>({
    url: `/time_entries/${entry.id}/stop`,
    method: "PATCH",
  });
  return true;
}

export async function restartTimer(entry: HarvestTimeEntry) {
  await harvestAPI<HarvestTimeEntryResponse>({
    url: `/time_entries/${entry.id}/restart`,
    method: "PATCH",
  });
  return true;
}

export async function deleteTimeEntry(entry: HarvestTimeEntry) {
  await harvestAPI<HarvestTimeEntryResponse>({
    url: `/time_entries/${entry.id}`,
    method: "DELETE",
  });
  return true;
}
