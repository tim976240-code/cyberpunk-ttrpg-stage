import React, { ReactElement, useState } from "react";
import { StageBase, StageResponse, InitialData, Message } from "@chub-ai/stages-ts";
import { LoadResponse } from "@chub-ai/stages-ts/dist/types/load";

interface CyberpunkState {
    hp: number;
    maxHp: number;
    humanity: number;
    eddies: number;
    stats: {
        BODY: number;
        REF: number;
        INT: number;
        TECH: number;
        COOL: number;
        EMP: number;
    };
    lastRollLog: string | null;
    pendingSystemRoll: string | null;
}

const DEFAULT_STATE: CyberpunkState = {
    hp: 40,
    maxHp: 40,
    humanity: 60,
    eddies: 500,
    stats: {
        BODY: 6,
        REF: 7,
        INT: 6,
        TECH: 5,
        COOL: 6,
        EMP: 6,
    },
    lastRollLog: "NO ROLLS LOGGED",
    pendingSystemRoll: null,
};

export class Stage extends StageBase<any, any, CyberpunkState, any> {
    stateData: CyberpunkState;

    constructor(data: InitialData<any, any, CyberpunkState, any>) {
        super(data);
        this.stateData = data.messageState
            ? { ...DEFAULT_STATE, ...data.messageState }
            : { ...DEFAULT_STATE };
    }

    async load(): Promise<Partial<LoadResponse<any, any, CyberpunkState>>> {
        return {
            success: true,
            error: null,
            initState: null,
            chatState: null,
        };
    }

    async setState(state: CyberpunkState): Promise<void> {
        if (state != null) {
            this.stateData = { ...this.stateData, ...state };
        }
    }

    async beforePrompt(userMessage: Message): Promise<Partial<StageResponse<any, CyberpunkState>>> {
        // Grab any dice roll queued since the last message
        const rollToSend = this.stateData.pendingSystemRoll;
        
        // Clear the queue so it doesn't repeat on future messages
        this.stateData.pendingSystemRoll = null;

        const statusSummary = `[VITALS: HP ${this.stateData.hp}/${this.stateData.maxHp} | HUM ${this.stateData.humanity} | €$ ${this.stateData.eddies}]`;
        const systemOutput = rollToSend
            ? `${rollToSend} ${statusSummary}`
            : null;

        return {
            stageDirections: `Current Player Stats: HP ${this.stateData.hp}/${this.stateData.maxHp}, Humanity ${this.stateData.humanity}, Eddies €$${this.stateData.eddies}.`,
            messageState: { ...this.stateData },
            modifiedMessage: null,
            systemMessage: systemOutput,
            error: null,
            chatState: null,
        };
    }

    async afterResponse(botMessage: Message): Promise<Partial<StageResponse<any, CyberpunkState>>> {
        return {
            stageDirections: null,
            messageState: { ...this.stateData },
            modifiedMessage: null,
            error: null,
            systemMessage: null,
            chatState: null,
        };
    }

    render(): ReactElement {
        return <CyberpunkHUD stage={this} />;
    }
}

// Interactive React UI Component
const CyberpunkHUD: React.FC<{ stage: Stage }> = ({ stage }) => {
    const [, forceUpdate] = useState(0);
    const [selectedStat, setSelectedStat] = useState<keyof CyberpunkState["stats"] | "NONE">("REF");

    const refresh = () => forceUpdate((n) => n + 1);
    const s = stage.stateData;

    const adjustVital = (key: "hp" | "humanity" | "eddies", amount: number) => {
        s[key] = Math.max(0, s[key] + amount);
        refresh();
    };

    const adjustStat = (stat: keyof CyberpunkState["stats"], amount: number) => {
        s.stats[stat] = Math.min(10, Math.max(1, s.stats[stat] + amount));
        refresh();
    };

    const rollDice = (sides: number) => {
        const rawRoll = Math.floor(Math.random() * sides) + 1;
        const modValue = selectedStat === "NONE" ? 0 : s.stats[selectedStat];
        const total = rawRoll + modValue;
        const modText = selectedStat === "NONE" ? "" : ` + ${selectedStat}(${modValue})`;

        // Cyberpunk RED critical check on d10
        let critNote = "";
        if (sides === 10 && rawRoll === 10) critNote = " [CRIT SUCCESS!]";
        if (sides === 10 && rawRoll === 1) critNote = " [CRIT FAIL!]";

        const resultText = `🎲 1d${sides}(${rawRoll})${modText} = ${total}${critNote}`;
        s.lastRollLog = resultText;
        s.pendingSystemRoll = `[SYSTEM CHECK: ${resultText}]`;
        refresh();
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <span style={styles.title}>// NETRUNNER_HUD v2.077</span>
                <span style={styles.eddies}>
                    €$ {s.eddies}
                    <button style={styles.miniBtn} onClick={() => adjustVital("eddies", -50)}>-50</button>
                    <button style={styles.miniBtn} onClick={() => adjustVital("eddies", 50)}>+50</button>
                </span>
            </div>

            {/* Vitals Bar */}
            <div style={styles.vitalsRow}>
                <div style={styles.vitalBox}>
                    <span style={styles.label}>HP</span>
                    <span style={{ ...styles.vitalValue, color: "#ff003c" }}>
                        {s.hp} / {s.maxHp}
                    </span>
                    <div>
                        <button style={styles.btn} onClick={() => adjustVital("hp", -5)}>-5</button>
                        <button style={styles.btn} onClick={() => adjustVital("hp", -1)}>-1</button>
                        <button style={styles.btn} onClick={() => adjustVital("hp", 1)}>+1</button>
                        <button style={styles.btn} onClick={() => adjustVital("hp", 5)}>+5</button>
                    </div>
                </div>

                <div style={styles.vitalBox}>
                    <span style={styles.label}>HUMANITY</span>
                    <span style={{ ...styles.vitalValue, color: "#00f0ff" }}>{s.humanity}</span>
                    <div>
                        <button style={styles.btn} onClick={() => adjustVital("humanity", -5)}>-5</button>
                        <button style={styles.btn} onClick={() => adjustVital("humanity", -1)}>-1</button>
                        <button style={styles.btn} onClick={() => adjustVital("humanity", 1)}>+1</button>
                        <button style={styles.btn} onClick={() => adjustVital("humanity", 5)}>+5</button>
                    </div>
                </div>
            </div>

            {/* Attributes Grid */}
            <div style={styles.statsGrid}>
                {(Object.keys(s.stats) as Array<keyof CyberpunkState["stats"]>).map((stat) => (
                    <div key={stat} style={styles.statCard}>
                        <div style={styles.statName}>{stat}</div>
                        <div style={styles.statNum}>{s.stats[stat]}</div>
                        <div>
                            <button style={styles.miniBtn} onClick={() => adjustStat(stat, -1)}>-</button>
                            <button style={styles.miniBtn} onClick={() => adjustStat(stat, 1)}>+</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Dice Roller */}
            <div style={styles.diceSection}>
                <div style={styles.diceControls}>
                    <select
                        value={selectedStat}
                        onChange={(e) => setSelectedStat(e.target.value as any)}
                        style={styles.select}
                    >
                        <option value="NONE">NO MODIFIER</option>
                        <option value="BODY">+ BODY ({s.stats.BODY})</option>
                        <option value="REF">+ REF ({s.stats.REF})</option>
                        <option value="INT">+ INT ({s.stats.INT})</option>
                        <option value="TECH">+ TECH ({s.stats.TECH})</option>
                        <option value="COOL">+ COOL ({s.stats.COOL})</option>
                        <option value="EMP">+ EMP ({s.stats.EMP})</option>
                    </select>

                    <button style={styles.rollBtn} onClick={() => rollDice(10)}>
                        ROLL 1d10
                    </button>
                    <button style={styles.rollBtnAlt} onClick={() => rollDice(20)}>
                        ROLL 1d20
                    </button>
                </div>

                <div style={styles.logBox}>
                    <div style={styles.logText}>{s.lastRollLog}</div>
                    {s.pendingSystemRoll && (
                        <div style={styles.queuedBadge}>
                            ⚡ QUEUED FOR NEXT MESSAGE
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Cyberpunk Inline Styling
const styles: { [key: string]: React.CSSProperties } = {
    container: {
        width: "100vw",
        height: "100vh",
        backgroundColor: "#0a0a0f",
        color: "#fcee0a",
        fontFamily: "'Courier New', Courier, monospace",
        padding: "12px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        border: "1px solid #fcee0a",
        overflowY: "auto",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid #ff003c",
        paddingBottom: "6px",
    },
    title: {
        fontWeight: "bold",
        fontSize: "14px",
        letterSpacing: "1px",
        color: "#00f0ff",
    },
    eddies: {
        fontWeight: "bold",
        fontSize: "14px",
        color: "#fcee0a",
        display: "flex",
        alignItems: "center",
        gap: "4px",
    },
    vitalsRow: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "10px",
        margin: "8px 0",
    },
    vitalBox: {
        backgroundColor: "#14141f",
        border: "1px solid #2a2a3d",
        padding: "8px",
        textAlign: "center",
    },
    label: {
        fontSize: "11px",
        color: "#8a8a9e",
        display: "block",
    },
    vitalValue: {
        fontSize: "18px",
        fontWeight: "bold",
        display: "block",
        margin: "4px 0",
    },
    statsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        gap: "6px",
        marginBottom: "8px",
    },
    statCard: {
        backgroundColor: "#14141f",
        border: "1px solid #00f0ff",
        padding: "6px 2px",
        textAlign: "center",
    },
    statName: {
        fontSize: "11px",
        color: "#00f0ff",
        fontWeight: "bold",
    },
    statNum: {
        fontSize: "16px",
        fontWeight: "bold",
        color: "#ffffff",
        margin: "2px 0",
    },
    diceSection: {
        backgroundColor: "#14141f",
        border: "1px solid #fcee0a",
        padding: "8px",
    },
    diceControls: {
        display: "flex",
        gap: "6px",
        marginBottom: "8px",
    },
    select: {
        backgroundColor: "#0a0a0f",
        color: "#00f0ff",
        border: "1px solid #00f0ff",
        padding: "6px",
        fontFamily: "inherit",
        fontSize: "12px",
        flex: 1,
    },
    rollBtn: {
        backgroundColor: "#fcee0a",
        color: "#0a0a0f",
        border: "none",
        padding: "6px 12px",
        fontWeight: "bold",
        fontFamily: "inherit",
        cursor: "pointer",
    },
    rollBtnAlt: {
        backgroundColor: "#00f0ff",
        color: "#0a0a0f",
        border: "none",
        padding: "6px 12px",
        fontWeight: "bold",
        fontFamily: "inherit",
        cursor: "pointer",
    },
    logBox: {
        backgroundColor: "#0a0a0f",
        padding: "6px",
        border: "1px dashed #ff003c",
        textAlign: "center",
    },
    logText: {
        fontSize: "13px",
        fontWeight: "bold",
        color: "#ffffff",
    },
    queuedBadge: {
        fontSize: "10px",
        color: "#fcee0a",
        marginTop: "4px",
    },
    btn: {
        backgroundColor: "#222233",
        color: "#ffffff",
        border: "1px solid #444466",
        padding: "2px 6px",
        margin: "0 2px",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: "11px",
    },
    miniBtn: {
        backgroundColor: "#222233",
        color: "#fcee0a",
        border: "1px solid #444466",
        padding: "1px 5px",
        margin: "0 1px",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: "11px",
    },
};


