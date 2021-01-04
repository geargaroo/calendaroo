var listEventRecurrences = function (rule, start, end, limItems, debugEnabled=false, debugFunc=console.debug) {
	/*
	This function which will find individual occurences of a calendar rule
	between start (js Date object) and end (js Date object)
	with a maximum number of limItems occurences
	each occurence is an object of two Dates (start and end)

	The basic structure of this function is a while loop which makes its way through
	a complex pyramid structure of unknown shape.

	**for purpose of examples, js Date objects are written in normal shorthand e.g. Januaury 5, 2010 @ 12:00 am as 1/5

	A = {start: 1/5, end: 1/10}
		basic: 1/5-1/10

	B = {start: 1/5, end: 1/10, max:6/30, recurrence: {interval: 1, units: "Months"}}
		recurrence: 1/5-1/10, 2/5-2/10, 3/5-3/10, 4/5-4/10, 5/5-5/10, 6/5-6/10
		basic:			1/5---------------------------------------------------------6/20

	C = {start: 1/5, end: 1/10, max:6/30, recurrence: {interval: 1, units: "Months"}, dateOfYear: [{min: {mo: 2, d:5}},{max: {mo: 6, d: 9}}]}]
		dateOfYear: 					2/6-2/10, 3/5-3/10, 4/5-4/10, 5/5-5/10, 6/5-6/9
		recurrence: 1/5-1/10, 2/5-2/10, 3/5-3/10, 4/5-4/10, 5/5-5/10, 6/5-6/10
		basic:			1/5	------------------------------------------------------6/20

	D = {start: 1/5, end: 1/10, max:6/30, recurrence: {interval: 1, units: "Months"}, dateOfYear: [{min: {mo: 2, d:5}},{max: {mo: 6, d: 9}}]}], dateOfMonth: [{ min: {'d':0}, max: {'d':6}},{ min: {'d':8}, max: {'d':20}}]
		dateOfMonth:										2/6-2/6, 2/8-2/10,		 3/5-3/6, 3/8-3/10, 	4/5-4/6, 4/8-4/10,	5/5-5/6, 5/8-5/10,	 6/5-6/6, 6/8-6/9,
		dateOfYear: 										2/6----------2/10,     3/5----------3/10, 	4/5----------4/10, 	5/5----------5/10, 	 6/5----------6/9
		recurrence: 1/5---------1/10, 	2/5----------2/10, 		 3/5----------3/10, 	4/5----------4/10, 	5/5----------5/10,	 6/5----------6/10
		basic:			1/5-----------------------------------------------------------------------------------------------------------------------------6/20

	*/

	//___________________________create log function for debugging________________
	let debug = function(){
		if (debugEnabled){
			debugFunc(...arguments)
		}
	}

	let debugObj = function(varObj){
		for (let [k,v] of Object.entries(varObj)){
			debug(k + "=", v)
		}
	}

	//___________________________initialize occurences____________________________
	let occurences = [];

	// __________________________enable defaults__________________________________
	//if no start is given, start finding occurences from beginning of rule
	if (start === undefined) { start = rule.start; }
	//if no end is given, search for occurences up to 25 Years after start
	if (end === undefined) { end = calTools.eventRecurrence(25, "Years", start);
	} else if (end === "full") { end = calTools.eventRecurrence(100, "Years", start); }

	if (Object.keys(rule).length == 2  && rule.start && rule.end){
		return [{start: rule.start, end: rule.end}]
	}
	//if rule does not have a maximum number of recurrences, set to 9,999
	if (!rule.recurrence){
		rule.recurrence = {
				interval: 9999,
				units: "Years",//Minutes, Days, Months, Years
				max: 1,
				startMode: 'date', // d,w,x,ld,lw
				endMode: 'date', // d,w,x,ld,lw
		}
	}
	if (rule.recurrence.max === undefined){rule.recurrence.max = 1}

	debugObj({rule})

	//__________________________find condition types of rule______________________
	//all possible types of conditions in order of how to check them
	let conditionOptions = ['recurrence', 'dateOfYear', 'dateOfMonth','dayOfWeek','timeOfDay', 'minuteOfHour'];

	//find the conditions included in this rule
	let conditionTypes = []
	for (let co of conditionOptions){
		if (Object.keys(rule).includes(co)){
			conditionTypes.push(co)
		}
	}

	//___________________________initialize variables for storage_________________
	let potentialTimeRange = { start: rule.start, end: rule.end }//temporary variable holding the bounds of the next occurence
	let conditionLevel = 0; //rule level, corresponds to index of conditionTypes
	let parent; //parent
	let maxIndices=[0]; //number of conditions in a given level
	let eventPyramid=[[[]]];//holds pyramid structure when narrows down startDate -dndDate to each occurrence
	let indices=[0]; //indices in conditions hierarchy

	//___________________________find maximum number of children at each level____
	for (let j=1;j<conditionTypes.length;j++){
		eventPyramid.push([[]]);
		indices.push(0);
		if (rule[conditionTypes[j]] !== undefined){
			maxIndices.push(rule[conditionTypes[j]].length)
		}else{
			maxIndices.push(-1)
		}
	}
	//_______________________________run while loop to find occurences____________
	debug("\n\ninitialState:")

	let iter = 0

	//check if loop is done, if not began new round
	while (!calTools.listCompleted(rule, occurences, limItems) && iter<500){
		iter++;

		//___________________________find the condition type based on index_________
		//'recurrence', 'dateOfYear', 'dateOfMonth','dayOfWeek','timeOfDay', or 'minuteOfHour'
		let condition = conditionTypes[conditionLevel];
		let layer = indices[conditionLevel]
		let layerRule = Object.assign({},rule[condition][layer])
		debugObj({rule})
		layerRule.max = {...{'h':23,'min':59,'s':59,'ms':999},...layerRule.max}

		//____________________________debug current state___________________________
		debug('\n\n')
		debug("top: ",iter)
		debugObj({indices,maxIndices,condition, conditionLevel, layer, layerRule})

		if (conditionLevel>0 && conditionLevel< conditionTypes.length ){//if not at beginning or end,go back up one recurrence level and then to the next event
			let parentConditionLevel = conditionLevel-1
			let parentConditionIndex = indices[parentConditionLevel] -1
			let parentSlice = eventPyramid[parentConditionLevel][parentConditionIndex]
			parent = parentSlice[parentSlice.length -1]
			debugObj({parent})
		}else if (conditionLevel>=conditionTypes.length){//if at end, go back to up the most recent unfinished recurrence level
			debug("finding most recent unfinished recurrence")
			let found= false

			//work backwords in conditionTypes
			for (let j=conditionTypes.length-1;j>=0;j--){
				if (indices[j]<(maxIndices[j])){
					if(!found){
						conditionLevel=j;
						found = true;
			  	}
				}
		  }

			for (let j=conditionLevel;j<conditionTypes.length;j++){indices[j]=0}
		  conditionLevel--;
		  if (!found){
				debug("found all occurences")
				debugObj({eventPyramid, occurences})
				return occurences
		  }
		}else{
			parent = {}
		}//else has no parent

		if ((rule[condition] === undefined) || (rule[condition].length===0)) {
			debugObj({conditionLevel})
			debug("ERROR: moving to next condition")
			conditionLevel++;
		}else if (condition === 'recurrence') { //if you are at the recurrence level, find the next recurrence

			//check if maximum number of recurrences have been completed
			let recurrencesCompleted = eventPyramid[conditionLevel][0]
			if (recurrencesCompleted.length === rule.recurrence.max){
				debug("finished recurrences")
				debugObj({eventPyramid, occurences})
			  return occurences
			}

			//find next recurrence
			let nextRecurrence = calTools.eventRecurrence(recurrencesCompleted.length, rule.recurrence.units, rule.start, rule.end, rule.startMode, rule.endMode)
			debugObj({nextRecurrence})
			eventPyramid[conditionLevel][0].push(nextRecurrence);

			//f recurrence if the highest level, add to occurences
			if (conditionLevel === (conditionTypes.length - 1)){
				occurences.push(nextRecurrence)
			}

			//increase index and move to next level
			indices[0]=1;
			conditionLevel++;
		}else { // else if you are not at the recurrence level
			//first check if parent is valid
			let invalidParent = (parent=== undefined) || isNaN(parent.start) || isNaN(parent.end)

			if (invalidParent) {
				//if parent is invalid, go to beginning of previous level
				debug("invalidParent: going to beginning of previous level")
				conditionLevel--; //go back up a level
				indices[conditionLevel]=0
			} else {
				//narrow down the potentialTimeRange you are searching in
				potentialTimeRange = { start: new Date(parent.start), end: new Date(parent.end)} //deep copy of parent

				//if a given rule/layer already has events in it, new event can't overlap
				//move start of search range to end of last event in layer
				let layerEvents = eventPyramid[conditionLevel][layer]
				debugObj({layerEvents})
				if (layerEvents){
					let lastEventInLayer = layerEvents[layerEvents.length -1]
					if (lastEventInLayer){
						let lastTime =  new Date(lastEventInLayer.end.valueOf() + 1)
						if (lastTime> potentialTimeRange.start){
							potentialTimeRange.start = lastTime
						}
					}
				}
				debugObj({potentialTimeRange})


				//initialize variables to track where to move for next loop iteration
				let levelJump = 1;
				let layerJump = 1;

				//check if layer is already completed
				let layerComplete = layer >= maxIndices[conditionLevel]

				if (layerComplete){
					//if layer is already completed, go back to beginning of parent
					debug("layerComplete")
					levelJump = -1;
					layerJump = -layer;
				}else{
					//set rule max to end of day, hour,min,s if not otherwise specified
					//e.g. an event with {min: {wd:0},max:{wd:0}} goes from Sunday at 12:00AM - Sunday at 11:59:59.999PM

					let eventFound = false;

					let order = 312;
					let i = 0

					//repeat this a second time only if order == 312
					while((i<2) && (order == 312)){
						i++;

						//find out if search range is before, partially before, fully within, partially after, or fully after of bounds
						debugObj({layerRule, potentialTimeRange})
						order = calTools.sortOrderDT([layerRule.min, potentialTimeRange.start, potentialTimeRange.end, layerRule.max]);
						debugObj({order})
						switch (order) {
	            case -1: //at least one of the dates was invalid
								levelJump = -1;
								layerJump = -layer;
								debug("invalid date")
								break;
							case 312: //min, 	max, start, end >> fully outside, move to other condition in level
								potentialTimeRange.start = calTools.quickDate(potentialTimeRange.start,layerRule.min,"next or equal")
								potentialTimeRange.end = calTools.quickDate(potentialTimeRange.start,layerRule.max,"next or equal")
								if (potentialTimeRange.start > parent.end){
									levelJump = -1;
									layerJump = -layer;
									i = 2;
								}
								if(i-=0){
									debug("potentialTimeRange is outside of min and max, trying again")
									debug("new potentialTimeRange=", potentialTimeRange)
								}else{
									debug("potentialTimeRange is still outside of min and max")
									levelJump = 0;
									if (layer>= (maxIndices[conditionLevel] - 1)){
										layerJump = -layer;
										debug("here2")
									}
								}
								break;
	            case 231: //min, 	end, max, start >>partially before, clip start
							case 213: //min, 	end, start, max >>partially before, clip start
								debug("must clip start of potentialTimeRange")
								potentialTimeRange.start = calTools.quickDate(potentialTimeRange.start,layerRule.min,"next or equal")
								eventFound = true;
								break;
							case 321: //min, 	max, end, start >> before and after, clip start and end
								debug("must clip start and end of potentialTimeRange")
								potentialTimeRange.start = calTools.quickDate(potentialTimeRange.start,layerRule.min,"next or equal")
								potentialTimeRange.end = calTools.quickDate(potentialTimeRange.start,layerRule.max,"next or equal")
								eventFound = true;
								break;
							case 132: //min, 	start, 	max, end>> partially after, clip end
								debug("must clip end of potentialTimeRange")
								let end = calTools.quickDate(potentialTimeRange.start,layerRule.max,"next or equal")
								potentialTimeRange.end = end
								eventFound = true;
								break;
							case 123: //min, 	start, 	end, max>> fully inside, good as is
								debug("potentialTimeRange is fully within the min and max of the rule")
								eventFound = true;
								break;
						}
					}

					if(potentialTimeRange.end > parent.end){
						eventFound = false;
						layerJump = -layer;
						levelJump = -1;
					}

					debugObj({eventFound, potentialTimeRange})
					if (eventFound){
						//check if there is a smaller occurence that can be made
						//e.g. if and event is M-W, make sure it is only 3 days, not 1 week + 3days, 2weeks + 3 days, etc.
						let end2 = calTools.quickDate(potentialTimeRange.start,layerRule.max,"next or equal")
						if (end2<potentialTimeRange.end){
							debug("shortening potentialTimeRange")
							potentialTimeRange.end = end2
						}

						//check if at the highest level
            if (conditionLevel === (conditionTypes.length -1)){
							//if level is complete, go back up one layer
							if ((layer===(maxIndices[conditionLevel]-1)) ){
								debug("level is complete, going back one level")
								layerJump = -1;
								levelJump = 0;
							}
							if ((potentialTimeRange.end < parent.end)){
								debug("at highest level, but may be incomplete, staying in level")
								// layerJump = 0;
								levelJump = 0;
							}
						}


						let deltaMs = potentialTimeRange.end - potentialTimeRange.start
						debugObj({deltaMs})
						if (deltaMs >0){
							//deep copy the time range before saving it
							let newEvent = genTools.clone(potentialTimeRange)
							debugObj({newEvent})

							//initialize space to add event
							while (eventPyramid[conditionLevel].length < (layer+1)){
								eventPyramid[conditionLevel].push([])
							}

							//add event to pyramid
							eventPyramid[conditionLevel][layer].push(newEvent)

							//if at highest level, add to occurences list
							if(conditionLevel === (conditionTypes.length - 1)){
								occurences.push(newEvent)
							}
						}
					}
				}
				debug("moving to appropriate layer and level")
				debugObj({layerJump, levelJump})
				indices[conditionLevel] += layerJump;
				if (indices[conditionLevel] < 0){
					indices[conditionLevel] = 0;
				}
				conditionLevel+= levelJump;
			}
		}
	}
	debug("finished while loop")
	debugObj({iter, eventPyramid, occurences})
	return occurences
}
