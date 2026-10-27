export const CardIDTag = "OBSIDANKI"

// Notes store IDs as %%OBSIDANKI/...%% comments; scheduling uses #OBSIDANKI/... internal keys.
export function IDComment(canonical: string): string {
	return `%%${canonical.replace(/^#/, "")}%%`
}

// 更新卡片第一行的卡片ID
export function UpdateCardIDTag(cardid:string, fileText:string, index:number):string {
    let tag = ` ${IDComment(`#${CardIDTag}/${cardid}`)}`
    for (let i=index;i<fileText.length;i++) {
        if (fileText[i] == "\n") {
            fileText = fileText.slice(0, i) + tag + fileText.slice(i)
            break;
        }
    }
    return fileText
}
