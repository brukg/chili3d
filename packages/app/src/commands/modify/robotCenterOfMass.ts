// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    combinedCenterOfMass,
    command,
    type IApplication,
    type ICommand,
    PubSub,
    totalMass,
} from "@chili3d/core";
import { robotPointMasses } from "./robotModel";

/**
 * Robot Center of Mass: the total mass (kg) and combined world centre of mass (mm) of the whole robot,
 * aggregating every link as a point mass at its own centre of mass weighted by its authored mass. This
 * is the robot-level COM that drives the stability check — distinct from Measure Center of Mass, which
 * is the volume centroid of a single solid.
 */
@command({
    key: "modify.robotCenterOfMass",
    icon: "icon-measureSelect",
})
export class RobotCenterOfMassCommand implements ICommand {
    async execute(application: IApplication): Promise<void> {
        const document = application.activeView?.document;
        if (!document) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const masses = robotPointMasses(document.modelManager.rootNode);
        const com = combinedCenterOfMass(masses);
        if (!com) {
            PubSub.default.pub("showToast", "toast.robot.noLinks");
            return;
        }
        PubSub.default.pub(
            "showToast",
            "toast.robot.com:{0}{1}{2}{3}",
            totalMass(masses).toFixed(4),
            com.x.toFixed(2),
            com.y.toFixed(2),
            com.z.toFixed(2),
        );
    }
}
