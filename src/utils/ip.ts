import { networkInterfaces } from "os";

export const localIp =
  Object.values(networkInterfaces())
    .flat()
    .find((ip) => {
      return ip?.family == "IPv4" && !ip.internal && ip.address;
    })?.address || null;
