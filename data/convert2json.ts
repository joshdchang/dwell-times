import { writeFileSync } from "fs";
import csvtojson from "csvtojson";

const data = await csvtojson().fromFile("./dwell_times.csv");

for (let i = 0; i < data.length; i++) {
  const row = data[i];
  if (row.Yard === "System Average") {
    data.splice(i, 1);
    i--;
    continue;
  }
  row.Date = new Date(row.Date).toISOString().split("T")[0];
  row.Week = Number(row.Week);
  row.Month = Number(row.Month);
  row.Year = Number(row.Year);
  row.Latitude = Number(row.Latitude);
  row.Longitude = Number(row.Longitude);
  row.Value = Number(row.Value);
  delete row["Yard Point"];
}

writeFileSync("./dwell_times.json", JSON.stringify(data, null, 2));
