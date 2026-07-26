import pptxgen from "pptxgenjs";
let pptx = new pptxgen();
console.log("pptxgen exports:", Object.keys(pptxgen));
console.log("pptx instance keys:", Object.keys(pptx));
if (pptx.ChartType) {
    console.log("pptx.ChartType keys:", Object.keys(pptx.ChartType));
} else {
    console.log("pptx.ChartType is undefined");
}
