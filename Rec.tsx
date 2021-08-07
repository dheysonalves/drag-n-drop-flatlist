import React, { createRef } from "react";
import { View, Text, Dimensions, SafeAreaView } from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import {
  RecyclerListView,
  DataProvider,
  LayoutProvider
} from "recyclerlistview";
import Animated from "react-native-reanimated";

const ViewTypes = {
  FULL: 0,
  HALF_LEFT: 1,
  HALF_RIGHT: 2
};

// Generate a hexadecimal randomColor
function getRandomColor() {
  var letters = "0123456789ABCDEF";
  var color = "#";
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function immutableMove(arr, from, to) {
  return arr.reduce((prev, current, idx, self) => {
    if (from === to) {
      prev.push(current);
    }
    if (idx === from) {
      return prev;
    }
    if (from < to) {
      prev.push(current);
    }
    if (idx === to) {
      prev.push(self[from]);
    }
    if (from > to) {
      prev.push(current);
    }
    return prev;
  }, []);
}

const colorMap = {};

const { cond, eq, add, call, set, Value, event, or } = Animated;

export default class RecycleTestComponent extends React.Component<
  {},
  { dataProvider: DataProvider; dragging: boolean; draggingIdx: number }
> {
  list = createRef<RecyclerListView<any, any>>();
  listContainer = createRef<View>();
  _layoutProvider: LayoutProvider;
  y: Animated.Node<number>;
  offY = new Value(0);
  gestureState = new Value(-1);
  onGestureEvent: any;
  rowHeight = 70;
  currIdx = -1;
  scrollOffset = 0;
  lastScrollOffset = -1;
  flatlistHeight = -1;
  topOffset = 0;
  scrolling = false;

  constructor(args) {
    super(args);

    let { width } = Dimensions.get("window");

    this.onGestureEvent = event([
      {
        nativeEvent: {
          absoluteY: this.offY, // the absolute Y value
          state: this.gestureState // current gesture state
        }
      }
    ]);

    // It subtracts the middle of rowHeight / 2
    this.y = add(this.offY, new Value(-this.rowHeight / 2));

    // Get the full layout size and height for 70px
    this._layoutProvider = new LayoutProvider(
      index => {
        return ViewTypes.FULL;
      },
      (type, dim) => {
        dim.width = width;
        dim.height = 70;
      }
    );

    this._rowRenderer = this._rowRenderer.bind(this);

    // Generate a array
    const arr = this._generateArray(300);

    // Returns a data which is diferent from the previous to the next
    let dataProvider = new DataProvider((r1, r2) => {
      return r1 !== r2;
    });

    this.state = {
      dragging: false,
      draggingIdx: -1,
      dataProvider: dataProvider.cloneWithRows(arr)
    };
  }

  // Generate a array of random Colors
  _generateArray(n) {
    return Array.from(Array(n), (_, i) => {
      colorMap[i] = getRandomColor();
      return i;
    });
  }

  // nope means that it is being dragged down
  _rowRenderer(type, data, index, _, nope) {
    nope = !!nope;
    return (
      <View
        style={{
          padding: 16,
          backgroundColor: nope ? "#f2f2f2" : colorMap[data],
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          opacity: !nope && index === this.state.draggingIdx ? 0 : 1
        }}
      >
        {nope ? (
          <View>
            <Text style={{ fontSize: 32 }}>@</Text>
          </View>
        ) : (
          <PanGestureHandler
            maxPointers={1}
            onGestureEvent={this.onGestureEvent}
            onHandlerStateChange={this.onGestureEvent}
          >
            <Animated.View>
              <Text style={{ fontSize: 32 }}>@</Text>
            </Animated.View>
          </PanGestureHandler>
        )}
        <Text style={{ fontSize: 18, textAlign: "center", flex: 1 }}>
          {data}
        </Text>
      </View>
    );
  }

  // Calculate the corrent absolute Y Index, and makes sure that doesnt goes under zero
  yToIndex = (y: number) =>
    Math.min(
      this.state.dataProvider.getSize() - 1,
      Math.max(
        0,
        Math.floor((y + this.scrollOffset - this.topOffset) / this.rowHeight)
      )
    );

  reset = () => {
    this.setState({
      dataProvider: this.state.dataProvider.cloneWithRows(
        this.state.dataProvider.getAllData()
      ),
      dragging: false,
      draggingIdx: -1
    });
    this.scrolling = false;
  };

  // It starts the dragging state
  start = ([y]) => {
    this.currIdx = this.yToIndex(y);
    this.setState({ dragging: true, draggingIdx: this.currIdx });
  };

  // Updates and reorder things
  updateOrder = y => {
    const newIdx = this.yToIndex(y);
    if (this.currIdx !== newIdx) {
      this.setState({
        dataProvider: this.state.dataProvider.cloneWithRows(
          immutableMove(
            this.state.dataProvider.getAllData(),
            this.currIdx,
            newIdx
          )
        ),
        draggingIdx: newIdx
      });
      this.currIdx = newIdx;
    }
  };

  moveList = amount => {
    if (!this.scrolling) {
      return;
    }

    this.list.current.scrollToOffset(
      this.scrollOffset + amount,
      this.scrollOffset + amount,
      false
    );

    requestAnimationFrame(() => {
      this.moveList(amount);
    });
  };

  move = ([y]) => {
    // Move to the botton with defined threshold
    if (y + 100 > this.flatlistHeight) {
		if (!this.scrolling) {
			this.scrolling = true;
			this.moveList(20);
		}
		// Move to the top with defined threshold
	} else if (y < 100) {
      if (!this.scrolling) {
        this.scrolling = true;
        this.moveList(-20);
      }
    } else {
      this.scrolling = false;
    }
    this.updateOrder(y); // Reorder the items list update
  };

  render() {
    const { dragging, dataProvider, draggingIdx } = this.state;

    return (
		<SafeAreaView style={{ flex: 1 }}>
			<Animated.Code>
				{() =>
					cond(
						eq(this.gestureState, State.BEGAN), // When some scenario has begun
						call([this.offY], this.start) // call this start
					)
				}
			</Animated.Code>
			<Animated.Code>
				{() =>
					cond(
						or(
							eq(this.gestureState, State.END),
							eq(this.gestureState, State.CANCELLED),
							eq(this.gestureState, State.FAILED),
							eq(this.gestureState, State.UNDETERMINED)
						),
						call([], this.reset) // Reset when each of theses scenarios occur
					)
				}
			</Animated.Code>
			<Animated.Code>
				{() =>
					cond(
						eq(this.gestureState, State.ACTIVE), // When active
						call([this.offY], this.move) // Move the item component
					)
				}
			</Animated.Code>
      {/* When dragging it renders the component with node as white label, changing the top absolute y position */}
			{dragging ? (
				<Animated.View
					style={{
						top: this.y, // It reposition while dragging
						position: "absolute",
						width: "100%",
						zIndex: 99,
						elevation: 99,
					}}>
					{this._rowRenderer(
						-1,
						dataProvider.getDataForIndex(draggingIdx),
						-1,
						-1,
						true
					)}
				</Animated.View>
			) : null}
			<View
				ref={this.listContainer}
				style={{ flex: 1 }}
				onLayout={(e) => {
					this.flatlistHeight = e.nativeEvent.layout.height;
					this.listContainer.current.measureInWindow((_x, y) => {
						this.topOffset = y;
					});
				}}>
				{/* ref - Reference the whole list element */}
				<RecyclerListView
					ref={this.list}
					style={{ flex: 1 }}
					onScroll={(e) => {
						this.scrollOffset = e.nativeEvent.contentOffset.y; // Scroll based on the list ref, on the y axis
					}}
					layoutProvider={this._layoutProvider} // Constructor function that defines the layout (height / width) of each element
					dataProvider={dataProvider} // Constructor function the defines the data for each element
					rowRenderer={this._rowRenderer} // Method that returns react component to be rendered. You get the type, data, index and extendedState of the view in the callback
				/>
			</View>
		</SafeAreaView>
	);
  }
}
