/**
 * Created by Curtis on 11/24/2015.
 */
/************************************************
 * mapVis.js
 ************************************************
 *
 * This script creates and controls the map
 * visualization. The map visualizes agreement with
 * congressional delegations across states. Color
 * encodes political party, and saturation encodes
 * agreement (high saturation indicates high
 * agreement, while low saturation indicates low
 * agreement). Notice that for a mixed delegation
 * (i.e. a Republican and a Democrat from the same
 * state) the hue will depend on how greatly the
 * members from the two parties agree with the
 * selection (in other words, there will be some
 * intermediate hue between blue and red). Clicking
 * a state changes the selection and adds both
 * members from the state's delegation to the
 * selection, while clearing what the selection
 * currently contains.
 *
 * main.js calls the function that creates and runs
 * the map, and also contains the dispatch object
 * used here. The data is loaded in main.js, and
 * congress.js contains its definitions. Notice
 * that the congress object must be active prior to
 * calling this function.
 *
  */

//mapVis():
/* In practice, mapVis is represented as an
object. This function creates an instance of the
mapVis object (vis "new"), and the function
itself defines the schema of the object. w sets the
visualization's width, and h sets the vis's height.
mt, mb, ml, and mr set the top, bottom, left, and
right margins, respectively. (Notice that the SVG's
width will be w + ml + mr, and its height will be
h + mt + mb.) scale sets the scaling of the map
(a bigger number implies a larger map). */

function MapVis(w, h, mt, mb, ml, mr, scale) {
    var self = this;

    // ScatterVis.svg:
    /* Simply the svg used by scatterVis, where the
    visualization is actually displayed. */
    self.svg = d3.select("#mapVis")
		.classed("svg-container", true)
		.select("svg")
		.attr("preserveAspectRatio", "xMinYMin meet")
		.attr("viewBox", "0 0 " + (w + ml + mr) + " " + (h + mt + mb))
		//.attr("width", w + ml + mr)
		//.attr("height", h + mt + mb)
		.classed("svg-content-responsive", true)
		.append("g")
		.attr("transform", "translate(" + ml + "," + mt + ")");

    // ScatterVis.projection:
    /* Controls the projection used by the map
    visualization (Albers USA projection). */
    self.projection = d3.geo.albersUsa()
                .translate([w / 2, h / 2])
                .scale([scale]);

    // ScatterVis.path
    /* This is an actual realization of the path
    used to draw the map, which depends on the
    projection specified in ScatterVis.projection. */
    self.path = d3.geo.path()
		.projection(self.projection);

    // MapVis.stateColor(state):
    /* This is a function that takes a string
    representing a state and outputs a string
    representing a hexadecimal code for the color
    for a state. This is some combination of hue and
    brightness depending on the state's
    delegation's party affiliation and agreement
    with the selection. */
    self.stateColor = function(state) {
	    /* This method is somewhat complex and
	    * difficult to understand. Basically,
	    * brightness indicates how frequently any
	    * member of the state's delegation agrees
	    * with the selection, and hue indicates the
	    * political leaning of the delegation.
	    * Ignoring third parties and independents
	    * for the moment, if the members of the
	    * state's delegation are from different
	    * parties, the hue of the color will be some
	    * intermediate value between red and blue,
	    * depending on whether the Democrat or the
	    * Republican are more inclined to agree with
	    * the selection. This is determined
	    * subtractively, basically with CMYK logic,
	    * which is then converted to an RGB color
	    * and finally a hex string. */

        // Delegation agreement determines lightness
        var sat = congress.stateAgreementPercent[state];
        // Initialize CMYK object that contains CM
        var cmyk = {C : 0, M : 0, Y : 0, K : 0};
        var rgbVal = {R : 0, G : 0, B : 0};
        // Will contain how many Republicans, Democrats, and Independents are in the delegation
        var rdi = {"R" : 0, "D" : 0, "I" : 0};
        var agreeRatio = {"R" : 0, "D" : 0, "I" : 0};

        // Get delegation's agreement with selection
        try {
            congress.metaData.delegations[state].forEach(function(member) {
                if (congress.nonselectedMembers.has(member)) {
                    rdi[congress.data.members[member].party] += congress.memberAgreementPercent[member];
                }
            });
        }
        catch (TypeError) {
            // Do nothing; stick with default
        }

        // Translate to "share of agreement", which will be used for determining hue
        if (rdi.R + rdi.D + rdi.I != 0) {		// Prevent division by zero
            agreeRatio = {"R" : (rdi.R / (rdi.R + rdi.D + rdi.I)),
                  "D" : (rdi.D / (rdi.R + rdi.D + rdi.I)),
                  "I" : (rdi.I / (rdi.R + rdi.D + rdi.I))};
        }

        // The following are CMYK definitions of the colors that correspond the the parties
        var RColor = {C : 0, M : 0, Y : 0, K : 0};
        var DColor = {C : 0, M : 0, Y : 0, K : 0};
        var IColor = {C : 0, M : 0, Y : 0, K : 0};

        // Republicans: crimson
        RColor.C = 0; RColor.M = .91; RColor.Y = .73; RColor.K = .14;

        // Democrats: dodgerblue
        DColor.C = .88; DColor.M = .44; DColor.Y = 0; DColor.K = 0;

        // Independents: gold
        IColor.C = 0; IColor.M = .16; IColor.Y = 1; IColor.K = 0;

        // Finally, get the CMYK hue  based on agreeRatio
        cmyk.C = sat * ((RColor.C * agreeRatio.R) + (DColor.C * agreeRatio.D) + (IColor.C * agreeRatio.I));
        cmyk.M = sat * ((RColor.M * agreeRatio.R) + (DColor.M * agreeRatio.D) + (IColor.M * agreeRatio.I));
        cmyk.Y = sat * ((RColor.Y * agreeRatio.R) + (DColor.Y * agreeRatio.D) + (IColor.Y * agreeRatio.I));
        cmyk.K = sat * ((RColor.K * agreeRatio.R) + (DColor.K * agreeRatio.D) + (IColor.K * agreeRatio.I));

        // Convert to RGB
        rgbVal.R = 255 * (1 - cmyk.C) * (1 - cmyk.K);
        rgbVal.G = 255 * (1 - cmyk.M) * (1 - cmyk.K);
        rgbVal.B = 255 * (1 - cmyk.Y) * (1 - cmyk.K);

        var color = d3.rgb(rgbVal.R, rgbVal.G, rgbVal.B);
        return color.toString();
    }

    // MapVis.tooltip():
    /* The tooltip is a div element that is added to
     the document when the object is created. It is
     manipulated by the mouseover events of the dots
     created and added to the scatterplot. */
    self.tooltip = d3.select("body").append("div")
        .attr('id', "mapVisTooltip")
        .attr("class", "hidden")
        .attr("transform", "translate(" + ml + "," + mt + ")")
        .append("p")
        .attr("id", "value");

    //Load in GeoJSON data
    d3.json("data/us-states.json", function (json) {
        //Merge the senate data and GeoJSON
        //Bind data and create one path per GeoJSON feature
        self.statePaths = self.svg.selectAll("path")
			  .data(json.features)
			  .enter()
			  .append("path")
			  .attr("d", self.path)
			  .on("click", function(d) {
			      // Make state's delegation the selection
			      var stateAbbrev = congress.metaData.state_full_abbrev[d.properties.name];

			      
			      if (!document.getElementById("keepSelection").checked) {
				  congress.clearMembers();
			      }
			      congress.addMember(congress.metaData.delegations[stateAbbrev]);
			      dispatch.selectionChanged();
			  })
			  .on("mouseover", function(d) {
			      var stateAbbrev = congress.metaData.state_full_abbrev[d.properties.name];
			      var delegation = congress.metaData.delegations[stateAbbrev];

			      // Get text to display
			      var formattedText = "";
			      for (i = 0; i < delegation.length; i++) {
				  formattedText = formattedText + delegation[i] +
				      " (" + congress.data.members[delegation[i]].party + "-" + congress.data.members[delegation[i]].state + "): " +
				      d3.round(100 * congress.memberAgreementPercent[delegation[i]]) + "%";
				  if (i < delegation.length - 1) {
				      formattedText = formattedText + "<br>";
				  }
			      }

			      var coordinates = [d3.event.pageX + 10, d3.event.pageY - 20];

			      // Fade clear
			      d3.select(this).transition().duration(250)
				  .attr("fill-opacity", .5);

			      // Move tooltip (code from: http://chimera.labs.oreilly.com/books/1230000000345/ch10.html#_html_div_tooltips)
			      // Update the tooltip position and value
			      d3.select("#mapVisTooltip")
				  .style("left", coordinates[0] + "px")
				  .style("top", coordinates[1] - 15 + "px")
				  .select("#value")
				  .html(formattedText);

			      // Show the tooltip
			      d3.select("#mapVisTooltip").classed("hidden", false);
			      dispatch.membersHovered(delegation);
			  })
			  .on("mouseout", function(d) {
			      d3.select(this).transition().duration(250)
				  .attr("fill-opacity", 1);

			      // Hide the tooltip
			      d3.select("#mapVisTooltip").classed("hidden", true);
			      dispatch.membersUnhovered();
			  });

	// MapVis.update():
	/* This function tells mapVis to update the
	visualization to update the values of the
	map. This function is called when the vis is
	first created and whenever the data needs to be
	updated (this usually is coordinated by the
	event handler defined in main.js). Note that the
	map geoJSON file us-states.json MUST BE LOADED
	in order for this to work. */
	self.update = function() {
	    self.statePaths
		.sort(function(d) {
			var stateAbbrev = congress.metaData.state_full_abbrev[d.properties.name];
			var delegation = congress.metaData.delegations[stateAbbrev];

			// Check if a member of the state's delegation is in the selection
			try {
			    for (i = 0; i < delegation.length; i++) {
				if (congress.selectedMembers.has(delegation[i])) {
				    return 1;
				}
			    }
			} catch (TypeError) {
			    // Do nothing
			}

			// Return normal color if no member is in selection
			return 0;
		})
		.attr("class", function(d) {
			var stateAbbrev = congress.metaData.state_full_abbrev[d.properties.name];
			var delegation = congress.metaData.delegations[stateAbbrev];

			// Check if a member of the state's delegation is in the selection
			try {
			    for (i = 0; i < delegation.length; i++) {
				if (congress.selectedMembers.has(delegation[i])) {
				    return "selectionState";
				}
			    }
			} catch (TypeError) {
			    // Do nothing
			}

			// Return normal color if no member is in selection
			return "normalState";
		})
		.transition().duration(350)
		.style("fill", function (d) {
			var stateAbbrev = congress.metaData.state_full_abbrev[d.properties.name];
			return self.stateColor(stateAbbrev);
		});
	}

	self.update();
    });
}
