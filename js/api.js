// js/api.js
// 공통 API 모듈 - 모든 fetch 호출이 이 파일을 통해 이루어짐
// 👉 BASE_URL 은 현재 ngrok 고정 도메인으로 설정되어 있음

const BASE_URL = "https://climbing-wholly-grouper.jp.ngrok.io";

/**
 * GET 요청
 * @param {string} path API 경로 (예: "/api/corn/summary")
 * @returns {Promise<any>}
 */
export async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}`);
  return res.json();
}

/**
 * POST 요청
 * @param {string} path API 경로
 * @param {object} data 전송할 JSON 데이터
 * @returns {Promise<any>}
 */
export async function apiPost(path, data) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`POST ${path} failed with ${res.status}`);
  return res.json();
}

/**
 * PUT 요청
 * @param {string} path API 경로
 * @param {object} data 전송할 JSON 데이터
 * @returns {Promise<any>}
 */
export async function apiPut(path, data) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed with ${res.status}`);
  return res.json();
}

/**
 * DELETE 요청
 * @param {string} path API 경로
 * @returns {Promise<any>}
 */
export async function apiDelete(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`DELETE ${path} failed with ${res.status}`);
  return res.json();
}
